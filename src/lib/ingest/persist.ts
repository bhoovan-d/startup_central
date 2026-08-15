import { eq, sql } from "drizzle-orm";

import {
  db,
  fundingRounds,
  investors,
  newsItems,
  roundInvestors,
  startups,
} from "@/db";

import { normalizeName, slugify, stripHtml, truncateWords } from "./normalize";
import type { ExtractedEvent } from "./schema";
import type { FeedItem } from "./rss";

/**
 * The maximum length of a stored excerpt, in characters.
 *
 * This is the copyright boundary, and it is enforced here rather than at the
 * call sites on purpose: a cap that each caller has to remember is a cap that
 * some future caller forgets. Facts — company, amount, round, investors —
 * aren't copyrightable; the publisher's prose is. We keep a headline, a link,
 * and enough words to attribute honestly, and nothing more.
 *
 * See the schema comment on `news_items` and the promise in the site footer.
 */
const EXCERPT_MAX = 200;

export function buildExcerpt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = stripHtml(raw);
  return clean ? truncateWords(clean, EXCERPT_MAX) : null;
}

/**
 * Records the article itself.
 *
 * `onConflictDoNothing` against the unique URL index doubles as the "have I
 * seen this?" check — which is what makes the whole run idempotent and safe to
 * fire every six hours. An empty return means we already have it.
 */
export async function recordNewsItem(
  item: FeedItem,
  sourceName: string,
): Promise<{ id: number } | null> {
  const rows = await db
    .insert(newsItems)
    .values({
      url: item.url,
      title: truncateWords(item.title, 300),
      sourceName,
      publishedAt: item.publishedAt,
      excerpt: buildExcerpt(item.description),
      status: "pending",
    })
    .onConflictDoNothing({ target: newsItems.url })
    .returning({ id: newsItems.id });

  return rows[0] ?? null;
}

/**
 * Looks up a company by its normalized name.
 *
 * Exact match only, and there is deliberately no "create if missing" path
 * here. Creating a `startups` row asserts that a company exists and is what we
 * say it is; only a human doing that through `npm run ingest:review` gets to
 * make that claim. An unmatched company means the item stays in the queue.
 */
export async function findStartupByName(
  name: string,
): Promise<{ id: number; slug: string; name: string } | null> {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const row = await db.query.startups.findFirst({
    columns: { id: true, slug: true, name: true },
    where: eq(startups.normalizedName, normalized),
  });

  return row ?? null;
}

/** Anything that can run a query — the db handle or an open transaction. */
type Executor = Pick<typeof db, "insert">;

/** Upserts an investor by normalized name and returns its id. */
async function upsertInvestor(tx: Executor, name: string): Promise<number | null> {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const rows = await tx
    .insert(investors)
    .values({ slug: slugify(name), name, normalizedName: normalized })
    .onConflictDoUpdate({
      target: investors.normalizedName,
      // A no-op write so the row is returned on conflict; `onConflictDoNothing`
      // returns nothing, which would cost a second query to resolve the id.
      set: { name: sql`excluded.name` },
    })
    .returning({ id: investors.id });

  return rows[0]?.id ?? null;
}

export type RoundWriteResult =
  | { status: "written"; roundId: number }
  | { status: "duplicate" }
  | { status: "skipped"; reason: string };

/**
 * Writes an auto-published funding round.
 *
 * The conflict target matches `funding_rounds_dedupe_idx` exactly — same
 * company, same round type, same day is the same round reported twice, so the
 * second report is dropped rather than duplicated.
 *
 * Known limitation: that index does not include the amount, so a later story
 * correcting an undisclosed figure is silently ignored. Filling a NULL amount
 * on conflict would be a safe improvement; overwriting a non-null one would
 * not, because a human may have entered it.
 *
 * The round and its investor links are written in one transaction, so a
 * failure partway through leaves no half-attributed round in the ledger.
 */
export async function writeRound(
  startupId: number,
  event: ExtractedEvent,
  source: { url: string; name: string },
): Promise<RoundWriteResult> {
  if (!event.announcedDate) {
    return { status: "skipped", reason: "no announced date" };
  }

  return db.transaction(async (tx): Promise<RoundWriteResult> => {
    const rows = await tx
      .insert(fundingRounds)
      .values({
        startupId,
        roundType: event.roundType ?? "undisclosed",
        amountUsd: event.amountUsd,
        amountInr: event.amountInr,
        announcedDate: event.announcedDate!,
        sourceUrl: source.url,
        sourceName: source.name,
        confidence: event.confidence,
        // Every row this function writes had no human in the loop. The flag is
        // what lets the UI mark it, and what lets a reviewer find it later.
        autoPublished: true,
      })
      .onConflictDoNothing({
        target: [
          fundingRounds.startupId,
          fundingRounds.roundType,
          fundingRounds.announcedDate,
        ],
      })
      .returning({ id: fundingRounds.id });

    const roundId = rows[0]?.id;
    if (roundId === undefined) return { status: "duplicate" };

    for (const investor of event.investors) {
      const investorId = await upsertInvestor(tx, investor.name);
      if (investorId === null) continue;

      await tx
        .insert(roundInvestors)
        .values({ roundId, investorId, isLead: investor.isLead })
        .onConflictDoNothing();
    }

    return { status: "written", roundId };
  });
}

/** Marks a news item resolved after a round was written from it. */
export async function markAutoPublished(
  newsItemId: number,
  startupId: number,
  event: ExtractedEvent,
): Promise<void> {
  await db
    .update(newsItems)
    .set({
      status: "auto_published",
      eventType: event.eventType,
      extracted: JSON.stringify(event),
      confidence: event.confidence,
      resolvedStartupId: startupId,
      reviewedAt: new Date(),
    })
    .where(eq(newsItems.id, newsItemId));
}

/**
 * Leaves a news item in the review queue with the extractor's output attached.
 *
 * `extracted` holds the structured facts only — never prose. It is kept so a
 * reviewer sees what the extractor thought, and so a re-run can be audited.
 */
export async function markPending(
  newsItemId: number,
  event: ExtractedEvent | null,
): Promise<void> {
  await db
    .update(newsItems)
    .set({
      status: "pending",
      eventType: event?.eventType,
      extracted: event ? JSON.stringify(event) : null,
      confidence: event?.confidence,
    })
    .where(eq(newsItems.id, newsItemId));
}
