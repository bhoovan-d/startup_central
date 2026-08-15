import { z } from "zod";

import { eventTypeEnum, roundTypeEnum } from "@/db/schema";

/**
 * The contract every extractor's output must satisfy before it goes anywhere
 * near the database.
 *
 * All three extractors — regex, Claude, and any OpenAI-compatible endpoint —
 * return `unknown` and are funnelled through this. That is the point: a model
 * that hallucinates a field, or a regex that captures a stray word, fails
 * validation and the item lands in the review queue instead of the ledger.
 */

// Passed straight through rather than widened to `[string, ...string[]]`:
// the cast would erase the literal union, and the resulting `string` type
// then fails to satisfy Drizzle's enum columns at every insert site.
const roundTypes = roundTypeEnum.enumValues;
const eventTypes = eventTypeEnum.enumValues;

export const ExtractedEvent = z.object({
  eventType: z.enum(eventTypes),

  /**
   * As written in the article, or null when no company could be identified.
   *
   * Nullable on purpose. An extraction that spotted a funding headline but
   * couldn't name the company is still worth recording for a reviewer — making
   * this required would make validation reject the whole event, discarding
   * the partial signal. Requiring a company is a job for the auto-publish
   * gate in `./index.ts`, not for the parser.
   */
  companyName: z.string().trim().min(1).max(120).nullable().default(null),

  roundType: z.enum(roundTypes).nullable().default(null),

  /**
   * Whole USD. The ceiling is a sanity bound, not a business rule: it catches
   * a model that read "$41 million" and emitted 41000000000000.
   */
  amountUsd: z.number().int().positive().max(100_000_000_000).nullable().default(null),

  /** Whole INR. Never derived from `amountUsd` — see `parseAmount`. */
  amountInr: z.number().int().positive().max(10_000_000_000_000).nullable().default(null),

  // zod v4 moved the ISO formats onto `z.iso`. `z.string().date()` is the v3
  // spelling and no longer exists.
  announcedDate: z.iso.date().nullable().default(null),

  investors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        isLead: z.boolean().default(false),
      }),
    )
    .max(12)
    .default([]),

  confidence: z.number().min(0).max(1),
});

export type ExtractedEvent = z.infer<typeof ExtractedEvent>;

/** The POST /api/ingest body. */
export const IngestRequest = z.object({
  /** Source keys from `./sources.ts`. Omitted means all enabled sources. */
  sources: z.array(z.string()).max(20).optional(),
  /**
   * Feed items to consider. Bounded so a run finishes inside the route's
   * `maxDuration` — the cron fires every six hours, so falling behind is
   * self-correcting.
   */
  limit: z.number().int().min(1).max(200).default(40),
  /** Fetch, parse and extract, but write nothing. */
  dryRun: z.boolean().default(false),
  /**
   * Skip ingestion entirely and just drop the query caches.
   *
   * The review CLI writes straight to Postgres, so it cannot call
   * `revalidateTag` — that only exists inside a request. Without this, an
   * approved round stays invisible for the cache TTL and reads as a bug.
   */
  revalidateOnly: z.boolean().default(false),
  /** Ignore feed items older than this. */
  since: z.iso.date().optional(),
});

export type IngestRequest = z.infer<typeof IngestRequest>;

export type IngestReport = {
  ok: boolean;
  fetched: number;
  parsed: number;
  newItems: number;
  extracted: number;
  autoPublished: number;
  pending: number;
  skipped: number;
  errors: string[];
  durationMs: number;
  dryRun: boolean;
};
