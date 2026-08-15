import { z } from "zod";

import {
  innovationTypeEnum,
  roundTypeEnum,
  shutdownCauseEnum,
  startupStatusEnum,
} from "@/db/schema";

/**
 * Parsers for `searchParams`.
 *
 * Every filter on this site is a URL parameter — the filter chips are plain
 * links, so there is no client-side state to validate against. That makes the
 * query string hand-editable by definition, and these parsers are the only
 * thing between `?page=-3` and an `OFFSET -60`.
 *
 * The house rule is that a bad parameter *degrades*, it does not throw: an
 * unparseable filter is dropped and the unfiltered list renders. A 500 on a
 * typo'd URL would be a worse answer than showing everything.
 */

export const PAGE_SIZE = 25;

/** In Next 16 `searchParams` resolves to this shape. */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * `?sector=a&sector=b` gives an array. We take the first value rather than
 * erroring — repeated params are almost always a link-building bug, and the
 * first one is what the user most likely clicked.
 */
function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const trimmed = s?.trim();
  return trimmed ? trimmed : undefined;
}

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

export function parsePage(v: string | string[] | undefined): number {
  return pageSchema.parse(first(v) ?? 1);
}

/** Postgres enums, parsed against the exact values in `src/db/schema.ts`. */
function parseEnum<T extends string>(
  v: string | string[] | undefined,
  values: readonly T[],
): T | undefined {
  const s = first(v);
  return s && (values as readonly string[]).includes(s) ? (s as T) : undefined;
}

export const parseRoundType = (v: string | string[] | undefined) =>
  parseEnum(v, roundTypeEnum.enumValues);

export const parseStartupStatus = (v: string | string[] | undefined) =>
  parseEnum(v, startupStatusEnum.enumValues);

export const parseShutdownCause = (v: string | string[] | undefined) =>
  parseEnum(v, shutdownCauseEnum.enumValues);

export const parseInnovationType = (v: string | string[] | undefined) =>
  parseEnum(v, innovationTypeEnum.enumValues);

/**
 * A tag slug. Not validated against the database here — an unknown slug simply
 * matches nothing, which is the correct empty result rather than an error.
 * The character class is what keeps it out of any LIKE pattern.
 */
const slugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9-]+$/)
  .optional()
  .catch(undefined);

export function parseSlug(v: string | string[] | undefined): string | undefined {
  return slugSchema.parse(first(v));
}

/** A plain "YYYY-MM-DD", for the funding date range. */
const dateSchema = z.iso.date().optional().catch(undefined);

export function parseDate(v: string | string[] | undefined): string | undefined {
  return dateSchema.parse(first(v));
}

/** A four-digit year, for the graveyard filter. */
const yearSchema = z.coerce
  .number()
  .int()
  .min(1990)
  .max(2100)
  .optional()
  .catch(undefined);

export function parseYear(v: string | string[] | undefined): number | undefined {
  return yearSchema.parse(first(v));
}

/**
 * The free-text search term. Capped hard: this is the one value that reaches
 * `websearch_to_tsquery`, and it is also the reason `searchStartups` is never
 * memoised — an unbounded key space would poison the cache.
 */
export function parseQuery(v: string | string[] | undefined): string | undefined {
  const s = first(v);
  return s ? s.slice(0, 120) : undefined;
}

export const SORTS = ["recent", "name", "raised"] as const;
export type Sort = (typeof SORTS)[number];

export function parseSort(v: string | string[] | undefined): Sort {
  return parseEnum(v, SORTS) ?? "recent";
}

/**
 * Rewrites the current query string, dropping keys set to undefined and always
 * resetting pagination.
 *
 * Every filter chip and pagination link goes through this, so "changing a
 * filter sends you back to page 1" is a property of the helper rather than
 * something each call site has to remember.
 */
export function buildHref(
  pathname: string,
  current: SearchParams,
  changes: Record<string, string | number | undefined>,
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    const v = first(value);
    if (v && !(key in changes) && key !== "page") next.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined && value !== "") next.set(key, String(value));
  }

  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}
