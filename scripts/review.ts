/**
 * Works the ingestion review queue.
 *
 *   npm run ingest:review
 *   npm run ingest:review -- --list
 *   npm run ingest:review -- --stats
 *   npm run ingest:review -- --reject-non-funding
 *   npm run ingest:review -- --reject-older-than 60
 *
 * This is the human in the loop, and for now it stands in for the `/admin`
 * screen described in .env.example — same job, no auth surface to build or
 * secure. It is also the ONLY place in the system that creates a `startups`
 * row: ingestion deliberately never does, because saying "this company exists
 * and this is its name" is a claim a person should make.
 */

// tsx doesn't load .env. See src/db/seed.ts.
import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

import { closeDb, db, newsItems, startups } from "@/db";
import { getExtractor } from "@/lib/ingest/extract";
import { ExtractedEvent } from "@/lib/ingest/schema";
import { normalizeName, slugify } from "@/lib/ingest/normalize";
import { writeRound } from "@/lib/ingest/persist";

const rl = createInterface({ input: stdin, output: stdout });

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Tells the running app to drop its query caches.
 *
 * This CLI writes straight to Postgres, so it can't call `revalidateTag` —
 * that only exists inside a request. Without this nudge an approved round
 * stays invisible for the cache TTL, which reads as a bug rather than as
 * caching. Best-effort: if the app isn't running, the TTL still expires.
 *
 * Point INGEST_URL at production to refresh the deployed site after a local
 * review session; it defaults to localhost.
 */
async function revalidate(): Promise<void> {
  const secret = process.env.INGEST_SECRET;
  const url = process.env.INGEST_URL ?? "http://localhost:3000/api/ingest";
  if (!secret) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ revalidateOnly: true }),
    });
    console.log(res.ok ? "Caches dropped." : `Revalidate returned HTTP ${res.status}.`);
  } catch {
    console.log("App not reachable — caches will expire on their own TTL.");
  }
}

async function stats() {
  const rows = await db.execute<{ status: string; n: number }>(sql`
    select status, count(*)::int as n from news_items group by status order by n desc
  `);
  console.log("Review queue:");
  for (const r of rows.rows) console.log(`  ${r.status.padEnd(16)} ${r.n}`);
}

/**
 * Re-runs the current extractor over every pending item.
 *
 * The stored `extracted` JSON is only ever as good as the extractor that
 * produced it. When that improves, the queue is still holding the old
 * verdicts — and because `news_items` dedupes on URL, a re-ingest will never
 * revisit them. This re-reads the stored title and excerpt (no re-fetching:
 * we never stored the article, and never will) and rewrites the verdict.
 */
async function reextract() {
  const extractor = await getExtractor();
  const queue = await db.query.newsItems.findMany({
    where: eq(newsItems.status, "pending"),
    limit: 500,
  });

  let changed = 0;
  for (const item of queue) {
    const raw = await extractor.extract({
      title: item.title,
      excerpt: item.excerpt ?? "",
      url: item.url,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt,
    });

    const parsed = ExtractedEvent.safeParse(raw);
    const next = parsed.success ? JSON.stringify(parsed.data) : null;
    if (next === item.extracted) continue;

    await db
      .update(newsItems)
      .set({
        extracted: next,
        eventType: parsed.success ? parsed.data.eventType : null,
        confidence: parsed.success ? parsed.data.confidence : null,
      })
      .where(eq(newsItems.id, item.id));
    changed += 1;
  }

  console.log(`Re-extracted ${queue.length} pending item(s); ${changed} changed.`);
}

/** Prints the queue without prompting. For triage before working it. */
async function list() {
  const queue = await db.query.newsItems.findMany({
    where: eq(newsItems.status, "pending"),
    orderBy: [desc(newsItems.publishedAt), desc(newsItems.id)],
    limit: 200,
  });

  for (const item of queue) {
    const parsed = item.extracted
      ? ExtractedEvent.safeParse(JSON.parse(item.extracted))
      : null;
    const e = parsed?.success ? parsed.data : null;
    const money = e?.amountUsd
      ? `$${e.amountUsd}`
      : e?.amountInr
        ? `INR ${e.amountInr}`
        : "-";
    console.log(
      `#${String(item.id).padStart(3)} ${(e?.eventType ?? "?").padEnd(11)} ` +
        `conf=${e?.confidence.toFixed(2) ?? "-"} ` +
        `co=${(e?.companyName ?? "-").padEnd(22)} ${money.padEnd(14)} ${item.title}`,
    );
  }
  console.log(`\n${queue.length} pending.`);
}

/**
 * Bulk-rejects everything the extractor did not read as a funding event.
 *
 * Safe to automate precisely because rejecting asserts nothing — it records
 * that we are not publishing a claim. Approving is the opposite, and stays
 * one item at a time.
 */
async function rejectNonFunding() {
  const queue = await db.query.newsItems.findMany({
    columns: { id: true, extracted: true, title: true },
    where: eq(newsItems.status, "pending"),
    limit: 500,
  });

  const doomed: number[] = [];
  for (const item of queue) {
    const parsed = item.extracted
      ? ExtractedEvent.safeParse(JSON.parse(item.extracted))
      : null;
    const e = parsed?.success ? parsed.data : null;
    // No usable extraction, not a funding story, no company, or no date —
    // none of these can produce a round, so the interactive flow would
    // refuse them anyway.
    if (!e || e.eventType !== "funding" || !e.companyName || !e.announcedDate) {
      doomed.push(item.id);
    }
  }

  if (doomed.length === 0) {
    console.log("Nothing to reject — every pending item is a funding candidate.");
    return;
  }

  await db
    .update(newsItems)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(inArray(newsItems.id, doomed));

  console.log(`Rejected ${doomed.length} non-funding item(s).`);
  console.log(`${queue.length - doomed.length} funding candidate(s) left to review.`);
}

/**
 * Approves specific items by id: `--approve 90,96`.
 *
 * Same effect as pressing `a` in the interactive flow — creates or reuses the
 * company, writes the round, marks the article approved — but scriptable, so
 * a triage decision made from `--list` can be applied without re-reading 30
 * prompts. Still one explicit id per approval: there is deliberately no
 * "approve everything above confidence X", because that is the auto-publish
 * path, and it already exists with a threshold and a matching requirement.
 */
async function approveIds(csv: string) {
  const ids = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) {
    console.log("usage: --approve 90,96");
    return;
  }

  for (const id of ids) {
    const item = await db.query.newsItems.findFirst({
      where: and(eq(newsItems.id, id), eq(newsItems.status, "pending")),
    });
    if (!item) {
      console.log(`  #${id} not pending — skipped`);
      continue;
    }

    const parsed = item.extracted
      ? ExtractedEvent.safeParse(JSON.parse(item.extracted))
      : null;
    const event = parsed?.success ? parsed.data : null;

    if (!event || event.eventType !== "funding" || !event.companyName || !event.announcedDate) {
      console.log(`  #${id} not an approvable funding event — skipped`);
      continue;
    }

    const startup = await createStartup(event.companyName, item.url);
    const written = await writeRound(
      startup.id,
      event,
      { url: item.url, name: item.sourceName },
      false,
    );

    await db
      .update(newsItems)
      .set({ status: "approved", resolvedStartupId: startup.id, reviewedAt: new Date() })
      .where(eq(newsItems.id, id));

    console.log(
      `  #${id} approved → ${startup.slug} (${written.status}${
        written.status === "written" ? ` #${written.roundId}` : ""
      })`,
    );
  }

  await revalidate();
}

/** Rejects specific items by id: `--reject 10,24`. */
async function rejectIds(csv: string) {
  const ids = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) {
    console.log("usage: --reject 10,24");
    return;
  }

  const rows = await db
    .update(newsItems)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(newsItems.status, "pending"), inArray(newsItems.id, ids)))
    .returning({ id: newsItems.id, title: newsItems.title });

  for (const r of rows) console.log(`  rejected #${r.id} ${r.title}`);
  console.log(`Rejected ${rows.length} item(s).`);
  await revalidate();
}

async function rejectOlderThan(days: number) {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .update(newsItems)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(newsItems.status, "pending"), lt(newsItems.createdAt, cutoff)))
    .returning({ id: newsItems.id });
  console.log(`Rejected ${rows.length} items older than ${days} days.`);
}

/**
 * Creates a company from a reviewed article, or binds to an existing one.
 *
 * `verified` is left at its default of false: a human has confirmed the
 * company is real and correctly named, which is not the same as having
 * checked every field on the record.
 */
async function createStartup(name: string, sourceUrl: string) {
  const normalized = normalizeName(name);
  const existing = await db.query.startups.findFirst({
    columns: { id: true, slug: true, name: true },
    where: eq(startups.normalizedName, normalized),
  });
  if (existing) return existing;

  const rows = await db
    .insert(startups)
    .values({
      slug: slugify(name),
      name,
      normalizedName: normalized,
      sourceUrls: [sourceUrl],
    })
    .returning({ id: startups.id, slug: startups.slug, name: startups.name });

  return rows[0]!;
}

async function review() {
  const queue = await db.query.newsItems.findMany({
    where: eq(newsItems.status, "pending"),
    orderBy: [desc(newsItems.publishedAt), desc(newsItems.id)],
    limit: 100,
  });

  if (queue.length === 0) {
    console.log("Queue is empty.");
    return;
  }

  console.log(`${queue.length} pending item(s). [a]pprove [b]ind [r]eject [s]kip [o]pen [q]uit\n`);

  for (const item of queue) {
    const parsed = item.extracted
      ? ExtractedEvent.safeParse(JSON.parse(item.extracted))
      : null;
    const event = parsed?.success ? parsed.data : null;

    console.log("─".repeat(72));
    console.log(item.title);
    console.log(`  ${item.sourceName} · ${item.publishedAt?.toISOString().slice(0, 10) ?? "no date"}`);
    console.log(`  ${item.url}`);
    if (item.excerpt) console.log(`  "${item.excerpt}"`);
    if (event) {
      console.log(
        `  → ${event.eventType} | ${event.companyName ?? "(no company)"} | ` +
          `${event.roundType ?? "-"} | usd=${event.amountUsd ?? "-"} inr=${event.amountInr ?? "-"} | ` +
          `date=${event.announcedDate ?? "-"} | conf=${event.confidence.toFixed(2)}`,
      );
    } else {
      console.log("  → no usable extraction");
    }

    const answer = (await rl.question("  action> ")).trim().toLowerCase();
    const [action, arg] = answer.split(/\s+/);

    if (action === "q") break;
    if (action === "s" || action === "") continue;

    if (action === "o") {
      console.log(`  ${item.url}`);
      continue;
    }

    if (action === "r") {
      await db
        .update(newsItems)
        .set({ status: "rejected", reviewedAt: new Date() })
        .where(eq(newsItems.id, item.id));
      console.log("  rejected");
      continue;
    }

    if (action === "a" || action === "b") {
      if (!event || event.eventType !== "funding" || !event.announcedDate) {
        console.log("  cannot approve: needs a funding event with a date. Rejecting instead is fine.");
        continue;
      }

      let startup: { id: number; slug: string; name: string } | undefined;

      if (action === "b") {
        if (!arg) {
          console.log("  usage: b <existing-startup-slug>");
          continue;
        }
        startup = await db.query.startups.findFirst({
          columns: { id: true, slug: true, name: true },
          where: eq(startups.slug, arg),
        });
        if (!startup) {
          console.log(`  no startup with slug "${arg}"`);
          continue;
        }
      } else {
        const name = event.companyName ?? (await rl.question("  company name> ")).trim();
        if (!name) {
          console.log("  skipped: no company name");
          continue;
        }
        startup = await createStartup(name, item.url);
      }

      // autoPublished: false — a person is sitting here deciding.
      const written = await writeRound(
        startup.id,
        event,
        { url: item.url, name: item.sourceName },
        false,
      );

      await db
        .update(newsItems)
        .set({
          status: "approved",
          resolvedStartupId: startup.id,
          reviewedAt: new Date(),
        })
        .where(eq(newsItems.id, item.id));

      console.log(
        written.status === "written"
          ? `  approved → ${startup.slug} (round #${written.roundId})`
          : written.status === "duplicate"
            ? `  approved → ${startup.slug} (round already recorded)`
            : `  approved → ${startup.slug} (no round: ${written.reason})`,
      );
    }
  }
}

async function main() {
  const older = flag("reject-older-than");

  if (process.argv.includes("--stats")) return stats();
  if (process.argv.includes("--list")) return list();
  if (process.argv.includes("--reextract")) return reextract();
  if (process.argv.includes("--reject-non-funding")) return rejectNonFunding();
  const approveCsv = flag("approve");
  if (approveCsv) return approveIds(approveCsv);
  const rejectCsv = flag("reject");
  if (rejectCsv) return rejectIds(rejectCsv);
  if (older) return rejectOlderThan(Number(older));
  return review();
}

// Closing readline releases stdin so the process can exit on its own. See the
// note in scripts/ingest.ts for why this isn't process.exit().
main()
  .catch((err) => {
    console.error("Review failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await closeDb();
  });
