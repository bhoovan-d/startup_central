import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db, shutdowns, startups } from "@/db";
import { PAGE_SIZE, pageCount } from "@/lib/params";

import { CACHE_TAGS, DETAIL_TTL, cached } from "./_cache";
import { flattenTags, primarySlot, type TagRef } from "./_filters";

export type ShutdownRow = {
  id: number;
  shutdownDate: string | null;
  causeTags: (typeof shutdowns.$inferSelect)["causeTags"];
  story: string | null;
  lessons: string | null;
  totalRaisedUsd: number | null;
  sourceUrl: string | null;
  startup: { slug: string; name: string; tagline: string | null } | null;
  tags: TagRef[];
  colorSlot: number | null;
};

export type ShutdownFilters = {
  cause?: string;
  year?: number;
  page?: number;
};

const SHUTDOWN_SELECT = {
  columns: {
    id: true,
    shutdownDate: true,
    causeTags: true,
    story: true,
    lessons: true,
    totalRaisedUsd: true,
    sourceUrl: true,
  },
  with: {
    startup: {
      columns: { slug: true, name: true, tagline: true },
      with: {
        tags: {
          columns: {},
          with: { tag: { columns: { slug: true, label: true, colorSlot: true } } },
        },
      },
    },
  },
} as const;

type RawShutdown = Omit<ShutdownRow, "startup" | "tags" | "colorSlot"> & {
  startup: {
    slug: string;
    name: string;
    tagline: string | null;
    tags: { tag: TagRef | null }[];
  } | null;
};

function toShutdownRow(r: RawShutdown): ShutdownRow {
  const tagRefs = flattenTags(r.startup?.tags);
  return {
    ...r,
    startup: r.startup
      ? { slug: r.startup.slug, name: r.startup.name, tagline: r.startup.tagline }
      : null,
    tags: tagRefs,
    colorSlot: primarySlot(tagRefs),
  };
}

function shutdownWhere(f: ShutdownFilters): SQL | undefined {
  const clauses: SQL[] = [];

  // `cause_tags` is an enum ARRAY — a company can die of more than one thing —
  // so this is array containment, not equality.
  //
  // The cause is bound as a parameter, not interpolated. It arrives already
  // validated against `shutdownCauseEnum` by `parseShutdownCause`, but a
  // filter builder that only stays safe because of what its caller does is a
  // trap for the next caller.
  if (f.cause) {
    clauses.push(
      sql`${shutdowns.causeTags} @> ARRAY[${f.cause}]::shutdown_cause[]`,
    );
  }
  if (f.year) {
    clauses.push(gte(shutdowns.shutdownDate, `${f.year}-01-01`));
    clauses.push(lte(shutdowns.shutdownDate, `${f.year}-12-31`));
  }

  return clauses.length ? and(...clauses) : undefined;
}

async function fetchShutdowns(f: ShutdownFilters) {
  const page = f.page ?? 1;
  const where = shutdownWhere(f);

  const [rows, total] = await Promise.all([
    db.query.shutdowns.findMany({
      ...SHUTDOWN_SELECT,
      where,
      orderBy: [desc(shutdowns.shutdownDate), desc(shutdowns.id)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.$count(shutdowns, where),
  ]);

  return {
    rows: (rows as RawShutdown[]).map(toShutdownRow),
    total,
    pageCount: pageCount(total),
  };
}

export const listShutdowns = cached(fetchShutdowns, ["shutdowns-list"], [
  CACHE_TAGS.shutdowns,
  CACHE_TAGS.startups,
]);

async function fetchRecentShutdowns(limit: number): Promise<ShutdownRow[]> {
  const rows = await db.query.shutdowns.findMany({
    ...SHUTDOWN_SELECT,
    orderBy: [desc(shutdowns.shutdownDate), desc(shutdowns.id)],
    limit,
  });
  return (rows as RawShutdown[]).map(toShutdownRow);
}

export const getRecentShutdowns = cached(
  fetchRecentShutdowns,
  ["shutdowns-recent"],
  [CACHE_TAGS.shutdowns, CACHE_TAGS.startups],
);

/**
 * A post-mortem, keyed by the *startup's* slug rather than the shutdown's id.
 * `shutdowns_startup_idx` is unique on `startup_id`, so one company has at
 * most one of these and the URL can be the company.
 */
async function fetchShutdownBySlug(slug: string): Promise<ShutdownRow | null> {
  const startup = await db.query.startups.findFirst({
    columns: { id: true },
    where: eq(startups.slug, slug),
  });
  if (!startup) return null;

  const row = await db.query.shutdowns.findFirst({
    ...SHUTDOWN_SELECT,
    where: eq(shutdowns.startupId, startup.id),
  });

  return row ? toShutdownRow(row as RawShutdown) : null;
}

export const getShutdownBySlug = cached(
  fetchShutdownBySlug,
  ["shutdown-detail"],
  [CACHE_TAGS.shutdowns, CACHE_TAGS.startups],
  DETAIL_TTL,
);

export async function getShutdownSlugs(limit = 100): Promise<{ slug: string }[]> {
  try {
    const rows = await db.query.shutdowns.findMany({
      columns: {},
      with: { startup: { columns: { slug: true } } },
      orderBy: [desc(shutdowns.shutdownDate)],
      limit,
    });
    return rows
      .map((r) => r.startup?.slug)
      .filter((s): s is string => Boolean(s))
      .map((slug) => ({ slug }));
  } catch {
    return [];
  }
}
