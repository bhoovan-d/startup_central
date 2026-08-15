import { cache as reactCache } from "react";
import { unstable_cache } from "next/cache";

/**
 * Caching for the query layer.
 *
 * `cacheComponents` is off in `next.config.ts`, so `use cache` / `cacheTag` /
 * `cacheLife` are unavailable and `unstable_cache` is the primitive. Keeping
 * every DB read behind this one module is what makes turning Cache Components
 * on later a mechanical edit rather than a rewrite: `unstable_cache(fn, keys,
 * {tags, revalidate})` maps 1:1 onto `'use cache'` + `cacheTag` + `cacheLife`.
 */

export const CACHE_TAGS = {
  stats: "stats",
  startups: "startups",
  rounds: "rounds",
  shutdowns: "shutdowns",
  innovations: "innovations",
  tags: "tags",
  episodes: "episodes",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Lists and aggregates: cheap to recompute, changes every ingest run. */
export const LIST_TTL = 900; // 15 min
/** Detail pages: one company's facts change far less often than the index. */
export const DETAIL_TTL = 3600; // 1 hour

/**
 * Memoise a query across requests.
 *
 * IMPORTANT — only wrap queries whose arguments have a *bounded* key space.
 * `listStartups({sector, status, page})` is bounded: eight sectors, four
 * statuses, a handful of pages. `searchStartups(q)` is not — every distinct
 * thing anyone types would mint a cache entry, so it is deliberately left
 * uncached. When in doubt, don't wrap it; an uncached Neon read is one HTTP
 * round trip, not a catastrophe.
 *
 * Two layers, and both earn their place:
 *
 *  - `unstable_cache` is the cross-request store, invalidated by tag when
 *    ingestion writes.
 *  - `react.cache` dedupes within a single render. That is what makes a detail
 *    page whose `generateMetadata` and body both call `getStartupBySlug(slug)`
 *    cost one lookup rather than two.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tags: CacheTag[],
  revalidate: number = LIST_TTL,
): (...args: Args) => Promise<Result> {
  return reactCache(unstable_cache(fn, keyParts, { tags, revalidate }));
}
