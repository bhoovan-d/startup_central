import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";

import { db, fundingRounds } from "@/db";
import { PAGE_SIZE, pageCount } from "@/lib/params";

import { CACHE_TAGS, cached } from "./_cache";
import { flattenTags, primarySlot, startupIdsInSector, type TagRef } from "./_filters";

export type RoundRow = {
  id: number;
  roundType: (typeof fundingRounds.$inferSelect)["roundType"];
  amountUsd: number | null;
  amountInr: number | null;
  announcedDate: string;
  sourceUrl: string | null;
  sourceName: string | null;
  /** True when ingestion wrote this row with no human in the loop. */
  autoPublished: boolean;
  startup: { slug: string; name: string; verified: boolean } | null;
  colorSlot: number | null;
  tags: TagRef[];
  leadInvestor: string | null;
  investors: { slug: string; name: string; isLead: boolean }[];
};

export type RoundFilters = {
  round?: string;
  sector?: string;
  from?: string;
  to?: string;
  page?: number;
};

/**
 * The shape every round query selects.
 *
 * `startup` names its columns explicitly to keep `search_vector` off the wire
 * — see the note in `./_filters.ts`.
 */
const ROUND_SELECT = {
  columns: {
    id: true,
    roundType: true,
    amountUsd: true,
    amountInr: true,
    announcedDate: true,
    sourceUrl: true,
    sourceName: true,
    autoPublished: true,
  },
  with: {
    startup: {
      columns: { slug: true, name: true, verified: true },
      with: {
        tags: {
          columns: {},
          with: { tag: { columns: { slug: true, label: true, colorSlot: true } } },
        },
      },
    },
    investors: {
      columns: { isLead: true },
      with: { investor: { columns: { slug: true, name: true } } },
    },
  },
} as const;

type RawRound = {
  id: number;
  roundType: RoundRow["roundType"];
  amountUsd: number | null;
  amountInr: number | null;
  announcedDate: string;
  sourceUrl: string | null;
  sourceName: string | null;
  autoPublished: boolean;
  startup: {
    slug: string;
    name: string;
    verified: boolean;
    tags: { tag: TagRef | null }[];
  } | null;
  investors: { isLead: boolean; investor: { slug: string; name: string } | null }[];
};

function toRoundRow(r: RawRound): RoundRow {
  const tagRefs = flattenTags(r.startup?.tags);
  const investors = r.investors
    .filter((i) => i.investor !== null)
    .map((i) => ({
      slug: i.investor!.slug,
      name: i.investor!.name,
      isLead: i.isLead,
    }));

  return {
    id: r.id,
    roundType: r.roundType,
    amountUsd: r.amountUsd,
    amountInr: r.amountInr,
    announcedDate: r.announcedDate,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    autoPublished: r.autoPublished,
    startup: r.startup
      ? { slug: r.startup.slug, name: r.startup.name, verified: r.startup.verified }
      : null,
    colorSlot: primarySlot(tagRefs),
    tags: tagRefs,
    leadInvestor: investors.find((i) => i.isLead)?.name ?? null,
    investors,
  };
}

function roundWhere(f: RoundFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (f.round) {
    clauses.push(eq(fundingRounds.roundType, f.round as RoundRow["roundType"]));
  }
  if (f.sector) {
    clauses.push(inArray(fundingRounds.startupId, startupIdsInSector(f.sector)));
  }
  if (f.from) clauses.push(gte(fundingRounds.announcedDate, f.from));
  if (f.to) clauses.push(lte(fundingRounds.announcedDate, f.to));

  return clauses.length ? and(...clauses) : undefined;
}

async function fetchRounds(f: RoundFilters) {
  const page = f.page ?? 1;
  const where = roundWhere(f);

  // Two round trips, issued concurrently rather than in sequence. neon-http
  // has no transactions and none is wanted here — a count that is one row
  // stale is not worth a connection upgrade.
  const [rows, total] = await Promise.all([
    db.query.fundingRounds.findMany({
      ...ROUND_SELECT,
      where,
      orderBy: [desc(fundingRounds.announcedDate), desc(fundingRounds.id)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.$count(fundingRounds, where),
  ]);

  return {
    rows: (rows as RawRound[]).map(toRoundRow),
    total,
    pageCount: pageCount(total),
  };
}

/**
 * Cached: the filter space here is bounded (13 round types x 8 sectors x a
 * handful of pages), so the key space stays small. The date range is the one
 * unbounded input — it is only reachable by hand-editing the URL, and the
 * 15-minute TTL bounds the damage.
 */
export const listRounds = cached(fetchRounds, ["rounds-list"], [
  CACHE_TAGS.rounds,
  CACHE_TAGS.startups,
]);

async function fetchRecentRounds(limit: number): Promise<RoundRow[]> {
  const rows = await db.query.fundingRounds.findMany({
    ...ROUND_SELECT,
    orderBy: [desc(fundingRounds.announcedDate), desc(fundingRounds.id)],
    limit,
  });
  return (rows as RawRound[]).map(toRoundRow);
}

export const getRecentRounds = cached(fetchRecentRounds, ["rounds-recent"], [
  CACHE_TAGS.rounds,
  CACHE_TAGS.startups,
]);

/** Every round for one company, newest first — the detail page's table. */
export async function getRoundsForStartup(startupId: number): Promise<RoundRow[]> {
  const rows = await db.query.fundingRounds.findMany({
    ...ROUND_SELECT,
    where: eq(fundingRounds.startupId, startupId),
    orderBy: [desc(fundingRounds.announcedDate)],
  });
  return (rows as RawRound[]).map(toRoundRow);
}
