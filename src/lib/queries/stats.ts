import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { Timestamplike } from "@/lib/format";

import { CACHE_TAGS, cached } from "./_cache";

export type SiteStats = {
  companies: number;
  /**
   * Disclosed USD only. Rounds reported in rupees are NOT folded in — see
   * `capitalInrOnly`. Any UI rendering this must say "disclosed", because the
   * honest reading of the number is "at least this much".
   */
  capitalUsd: number;
  /** Sum of INR-reported rounds that carry no USD figure at all. */
  capitalInrOnly: number;
  roundsThisMonth: number;
  /** This month minus last month. Zero when there is nothing to compare. */
  roundsDelta: number;
  graveyard: number;
  /** "YYYY-MM-DD" of the earliest round on record, or null when empty. */
  earliestRound: string | null;
};

type StatsRow = {
  companies: number;
  capital_usd: string;
  capital_inr_only: string;
  rounds_this_month: number;
  rounds_last_month: number;
  graveyard: number;
  earliest_round: string | null;
};

async function fetchSiteStats(): Promise<SiteStats> {
  // One statement carrying scalar subqueries rather than six `count()` calls:
  // neon-http is an HTTP round trip per statement, so six calls is six trips
  // for a strip of four numbers.
  //
  // The `::text` casts on the sums are not cosmetic. These are bigint columns,
  // and a bigint SUM exceeds Number.MAX_SAFE_INTEGER in principle; the driver
  // hands them back as strings either way. Casting makes that explicit so the
  // `Number()` below is a deliberate narrowing rather than a surprise.
  const result = await db.execute<StatsRow>(sql`
    select
      (select count(*) from startups)::int                                as companies,
      (select coalesce(sum(amount_usd), 0) from funding_rounds)::text     as capital_usd,
      (select coalesce(sum(amount_inr), 0) from funding_rounds
         where amount_usd is null)::text                                  as capital_inr_only,
      (select count(*) from funding_rounds
         where announced_date >= date_trunc('month', current_date))::int  as rounds_this_month,
      (select count(*) from funding_rounds
         where announced_date >= date_trunc('month', current_date - interval '1 month')
           and announced_date <  date_trunc('month', current_date))::int  as rounds_last_month,
      (select count(*) from shutdowns)::int                               as graveyard,
      (select min(announced_date) from funding_rounds)::text              as earliest_round
  `);

  const row = result.rows[0];

  // A totally empty database still returns one row of zeros, so this branch is
  // only reachable if the statement itself returned nothing.
  if (!row) {
    return {
      companies: 0,
      capitalUsd: 0,
      capitalInrOnly: 0,
      roundsThisMonth: 0,
      roundsDelta: 0,
      graveyard: 0,
      earliestRound: null,
    };
  }

  return {
    companies: Number(row.companies),
    capitalUsd: Number(row.capital_usd),
    capitalInrOnly: Number(row.capital_inr_only),
    roundsThisMonth: Number(row.rounds_this_month),
    roundsDelta: Number(row.rounds_this_month) - Number(row.rounds_last_month),
    graveyard: Number(row.graveyard),
    earliestRound: row.earliest_round,
  };
}

export const getSiteStats = cached(fetchSiteStats, ["site-stats"], [
  CACHE_TAGS.stats,
  CACHE_TAGS.startups,
  CACHE_TAGS.rounds,
  CACHE_TAGS.shutdowns,
]);

export type SectorSlice = {
  slug: string;
  label: string;
  colorSlot: number | null;
  count: number;
};

async function fetchSectorBreakdown(): Promise<SectorSlice[]> {
  // A LEFT JOIN, so all eight sectors come back even with zero companies in
  // them. Ordered by `color_slot`, never by count — colour follows the entity,
  // so the legend must not reorder itself as the data changes.
  const result = await db.execute<{
    slug: string;
    label: string;
    color_slot: number | null;
    n: number;
  }>(sql`
    select t.slug, t.label, t.color_slot, count(st.startup_id)::int as n
    from tags t
    left join startup_tags st on st.tag_id = t.id
    group by t.id, t.slug, t.label, t.color_slot
    order by t.color_slot nulls last, t.slug
  `);

  return result.rows.map((r) => ({
    slug: r.slug,
    label: r.label,
    colorSlot: r.color_slot,
    count: Number(r.n),
  }));
}

export const getSectorBreakdown = cached(
  fetchSectorBreakdown,
  ["sector-breakdown"],
  [CACHE_TAGS.stats, CACHE_TAGS.tags, CACHE_TAGS.startups],
);

/**
 * The newest `created_at` across the tables ingestion writes to.
 *
 * Returns `Timestamplike`, not `Date`, and the distinction is load-bearing:
 * `cached()` serialises through JSON, so this returns a `Date` on a cache miss
 * and the equivalent ISO string on a hit. Declaring `Date` here made the type
 * a lie exactly where it mattered and crashed the homepage in production.
 * Format it through `formatTimestamp`, which accepts both.
 */
async function fetchLastUpdated(): Promise<Timestamplike> {
  const result = await db.execute<{ last_updated: string | null }>(sql`
    select greatest(
      (select max(created_at) from funding_rounds),
      (select max(created_at) from startups),
      (select max(created_at) from shutdowns)
    )::text as last_updated
  `);

  const raw = result.rows[0]?.last_updated;
  return raw ? new Date(raw) : null;
}

export const getLastUpdated = cached(fetchLastUpdated, ["last-updated"], [
  CACHE_TAGS.stats,
  CACHE_TAGS.rounds,
  CACHE_TAGS.startups,
]);
