import { eq, sql } from "drizzle-orm";

import {
  db,
  fundingRounds,
  investors,
  newsItems,
  roundInvestors,
  startupTags,
  startups,
  tags,
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

/**
 * Creates a company from an extraction, when auto-creation is switched on.
 *
 * Off by default, and the default is the safe one: creating a `startups` row
 * asserts that a company exists and is named this, which is a claim. With
 * INGEST_AUTOCREATE_STARTUPS=true the pipeline makes that claim itself and
 * marks it `verified: false`, so the site renders an "Unverified" badge until
 * a person confirms it. That is the whole trade — more volume, visibly
 * flagged, audited after the fact rather than gated before.
 *
 * Returns null when the flag is off, which sends the item to review.
 */
export async function autoCreateStartup(
  name: string,
  sourceUrl: string,
): Promise<{ id: number; slug: string } | null> {
  if (process.env.INGEST_AUTOCREATE_STARTUPS !== "true") return null;

  const normalized = normalizeName(name);
  if (!normalized) return null;

  const rows = await db
    .insert(startups)
    .values({
      slug: slugify(name),
      name,
      normalizedName: normalized,
      sourceUrls: [sourceUrl],
    })
    // A race between two runs, or a slug collision between two different
    // companies whose names slugify the same, must not abort the run.
    .onConflictDoNothing()
    .returning({ id: startups.id, slug: startups.slug });

  if (rows[0]) return rows[0];

  // onConflictDoNothing returned nothing, so someone already has this
  // normalized name — use theirs.
  const existing = await findStartupByName(name);
  return existing ? { id: existing.id, slug: existing.slug } : null;
}

/**
 * Files a company under a sector, if the extractor named a known one.
 *
 * Silently does nothing for an unrecognised slug: an unknown sector should
 * leave the company untagged, not fail the write. Untagged companies render
 * in ink rather than borrowing another sector's colour.
 */
export async function tagStartupSector(
  startupId: number,
  sectorSlug: string | null,
): Promise<void> {
  if (!sectorSlug) return;

  const tag = await db.query.tags.findFirst({
    columns: { id: true },
    where: eq(tags.slug, sectorSlug),
  });
  if (!tag) return;

  await db
    .insert(startupTags)
    .values({ startupId, tagId: tag.id })
    .onConflictDoNothing();
}

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
  /**
   * False when a human approved this through the review CLI.
   *
   * The flag drives the "Auto-extracted" marker in the UI, so getting it
   * wrong misattributes the row: a reviewed round would claim nobody looked
   * at it. Defaults to true because the unattended pipeline is the caller
   * that must never forget to say so.
   */
  autoPublished = true,
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
        autoPublished,
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
 * Marks an item out of scope, with the reason kept for auditing.
 *
 * Distinct from `pending`: this is a decision, not a backlog. It stays in
 * `news_items` rather than being deleted so the URL dedupe still recognises
 * it on the next run and it never gets re-fetched or re-judged.
 */
export async function markRejected(
  newsItemId: number,
  event: ExtractedEvent | null,
  reason: string,
): Promise<void> {
  await db
    .update(newsItems)
    .set({
      status: "rejected",
      eventType: event?.eventType,
      extracted: event ? JSON.stringify({ ...event, rejectedBecause: reason }) : null,
      confidence: event?.confidence,
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
