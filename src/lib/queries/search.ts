import { sql } from "drizzle-orm";

import { db } from "@/db";
import { PAGE_SIZE, pageCount } from "@/lib/params";

export type SearchHit = {
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  hqCity: string | null;
  verified: boolean;
  /** ts_rank, or 0 for prefix-fallback hits. Not shown; kept for ordering. */
  rank: number;
};

export type SearchResult = {
  rows: SearchHit[];
  total: number;
  pageCount: number;
  /** True when the tsvector query found nothing and we fell back to a prefix. */
  fallback: boolean;
};

type Row = {
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  hq_city: string | null;
  verified: boolean;
  rank: number;
  total: number;
};

function toHits(rows: Row[]): SearchHit[] {
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    status: r.status,
    hqCity: r.hq_city,
    verified: r.verified,
    rank: Number(r.rank),
  }));
}

const EMPTY: SearchResult = { rows: [], total: 0, pageCount: 1, fallback: false };

/**
 * Full-text search over `startups`.
 *
 * This is the reason the schema carries a generated `search_vector` column and
 * a GIN index instead of an external search service — see the note at the top
 * of `src/db/schema.ts`.
 *
 * Deliberately NOT wrapped in `cached()`. Its argument is whatever anyone
 * types, so memoising it would mint a cache entry per distinct query and the
 * key space is unbounded. An uncached Neon read is one HTTP round trip.
 */
export async function searchStartups(
  q: string,
  page = 1,
): Promise<SearchResult> {
  const term = q.trim();
  if (!term) return EMPTY;

  const offset = (page - 1) * PAGE_SIZE;

  // `websearch_to_tsquery`, never `to_tsquery`: the latter is a parser for a
  // query *language* and raises a syntax error on ordinary input like
  // "sarvam ai" or a stray quote. websearch_ accepts anything a person types.
  //
  // The 'english' config has to match the generated column in schema.ts or
  // Postgres will not use the GIN index.
  //
  // `count(*) over ()` rides along on the same statement so pagination costs
  // one round trip rather than two.
  const ranked = term.length >= 3
    ? await db.execute<Row>(sql`
        with q as (select websearch_to_tsquery('english', ${term}) as tsq)
        select
          s.slug, s.name, s.tagline, s.status, s.hq_city, s.verified,
          ts_rank(s.search_vector, q.tsq) as rank,
          count(*) over ()::int as total
        from startups s, q
        where s.search_vector @@ q.tsq
        order by rank desc, s.name asc
        limit ${PAGE_SIZE} offset ${offset}
      `)
    : { rows: [] as Row[] };

  if (ranked.rows.length > 0) {
    const total = Number(ranked.rows[0]!.total);
    return { rows: toHits(ranked.rows), total, pageCount: pageCount(total), fallback: false };
  }

  // Fallback. A tsvector matches whole lexemes, so "sarv" finds nothing even
  // though "Sarvam" is right there — which reads as broken to anyone typing
  // into a search box. A prefix match on the name covers that, and also covers
  // terms under three characters that we never sent to tsquery at all.
  const prefix = await db.execute<Row>(sql`
    select
      s.slug, s.name, s.tagline, s.status, s.hq_city, s.verified,
      0::real as rank,
      count(*) over ()::int as total
    from startups s
    where s.name ilike ${term + "%"}
    order by s.name asc
    limit ${PAGE_SIZE} offset ${offset}
  `);

  if (prefix.rows.length === 0) return EMPTY;

  const total = Number(prefix.rows[0]!.total);
  return { rows: toHits(prefix.rows), total, pageCount: pageCount(total), fallback: true };
}
