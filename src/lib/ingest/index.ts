import { getExtractor } from "./extract";
import { createRegexExtractor } from "./extract/regex";
import {
  findStartupByName,
  markAutoPublished,
  markPending,
  recordNewsItem,
  writeRound,
} from "./persist";
import { fetchFeed } from "./rss";
import { ExtractedEvent, type IngestReport, type IngestRequest } from "./schema";
import { resolveSources } from "./sources";

/**
 * One ingest run.
 *
 * Shared by the route handler and the CLI so both behave identically — the
 * only difference between `POST /api/ingest` and `npm run ingest` is who
 * authenticated.
 */
export async function runIngest(req: IngestRequest): Promise<IngestReport> {
  const startedAt = Date.now();
  const errors: string[] = [];

  const sources = resolveSources(req.sources);
  const threshold = autopublishThreshold();
  const extractor = await getExtractor();
  // Kept around so a failed LLM call for one item can still be extracted
  // rather than skipped entirely.
  const regex = createRegexExtractor();

  let fetched = 0;
  let parsed = 0;
  let newItems = 0;
  let extracted = 0;
  let autoPublished = 0;
  let pending = 0;
  let skipped = 0;

  // Fetch every feed concurrently but catch per-source: one publisher blocking
  // us, changing a URL, or serving an HTML 404 must not take the run down.
  const feeds = await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await fetchFeed(source.feedUrl, source.name);
        return { source, items };
      } catch (err) {
        errors.push(`${source.key}: ${(err as Error).message}`);
        return { source, items: [] };
      }
    }),
  );

  const since = req.since ? new Date(req.since) : null;

  // Flatten, filter, then cap. The cap is what keeps a run inside the route's
  // maxDuration; the six-hourly cron means falling behind self-corrects.
  const queue = feeds
    .flatMap(({ source, items }) => {
      fetched += items.length;
      return items
        .filter((item) => !source.titleFilter || source.titleFilter.test(item.title))
        .filter((item) => !since || !item.publishedAt || item.publishedAt >= since)
        .map((item) => ({ item, source }));
    })
    .slice(0, req.limit);

  parsed = queue.length;

  for (const { item, source } of queue) {
    try {
      if (req.dryRun) {
        const raw = await extractor.extract({
          title: item.title,
          excerpt: item.description,
          url: item.url,
          sourceName: source.name,
          publishedAt: item.publishedAt,
        });
        const result = ExtractedEvent.safeParse(raw);
        if (result.success) extracted += 1;
        else skipped += 1;
        continue;
      }

      const news = await recordNewsItem(item, source.name);
      if (!news) {
        // Already seen. This is the common case on a healthy cron.
        skipped += 1;
        continue;
      }
      newItems += 1;

      const input = {
        title: item.title,
        excerpt: item.description,
        url: item.url,
        sourceName: source.name,
        publishedAt: item.publishedAt,
      };

      // The chosen extractor, then regex if it returned nothing (a provider
      // outage, a rate limit) so an LLM failure degrades rather than skips.
      let raw = await extractor.extract(input);
      if (raw === null && extractor.name !== "regex") {
        raw = await regex.extract(input);
      }

      const result = ExtractedEvent.safeParse(raw);
      if (!result.success) {
        await markPending(news.id, null);
        pending += 1;
        continue;
      }

      const event = result.data;
      extracted += 1;

      const decision = await decide(event, threshold);

      if (decision.autoPublish) {
        const written = await writeRound(decision.startupId, event, {
          url: item.url,
          name: source.name,
        });

        if (written.status === "written" || written.status === "duplicate") {
          await markAutoPublished(news.id, decision.startupId, event);
          autoPublished += 1;
          continue;
        }
      }

      await markPending(news.id, event);
      pending += 1;
    } catch (err) {
      errors.push(`${item.url}: ${(err as Error).message}`);
      skipped += 1;
    }
  }

  return {
    ok: true,
    fetched,
    parsed,
    newItems,
    extracted,
    autoPublished,
    pending,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    dryRun: req.dryRun,
  };
}

type Decision =
  | { autoPublish: true; startupId: number }
  | { autoPublish: false };

/**
 * The auto-publish gate. Four conditions, all required.
 *
 * Only funding events pass. Shutdowns, launches and acquisitions always go to
 * review: `shutdowns.cause_tags` is a NOT NULL enum array and `story` and
 * `lessons` are explicitly our own words, so no extractor gets to decide why
 * a company died.
 */
async function decide(event: ExtractedEvent, threshold: number): Promise<Decision> {
  if (event.eventType !== "funding") return { autoPublish: false };
  if (event.confidence < threshold) return { autoPublish: false };
  if (!event.announcedDate) return { autoPublish: false };
  if (!event.companyName) return { autoPublish: false };

  const startup = await findStartupByName(event.companyName);
  if (!startup) return { autoPublish: false };

  return { autoPublish: true, startupId: startup.id };
}

function autopublishThreshold(): number {
  const raw = Number(process.env.INGEST_AUTOPUBLISH_THRESHOLD ?? 0.85);
  if (!Number.isFinite(raw)) return 0.85;
  return Math.max(0, Math.min(1, raw));
}
