import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";

import { db, innovationTypeEnum, startups } from "@/db";
import { PAGE_SIZE, pageCount, type Sort } from "@/lib/params";

import { CACHE_TAGS, DETAIL_TTL, cached } from "./_cache";
import {
  STARTUP_CARD_COLUMNS,
  flattenTags,
  primarySlot,
  startupIdsInSector,
  type TagRef,
} from "./_filters";
import { getRoundsForStartup, type RoundRow } from "./funding";

export type StartupCard = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  status: (typeof startups.$inferSelect)["status"];
  hqCity: string | null;
  verified: boolean;
  tags: TagRef[];
  colorSlot: number | null;
};

export type StartupFilters = {
  sector?: string;
  status?: string;
  page?: number;
  sort?: Sort;
};

const CARD_SELECT = {
  columns: STARTUP_CARD_COLUMNS,
  with: {
    tags: {
      columns: {},
      with: { tag: { columns: { slug: true, label: true, colorSlot: true } } },
    },
  },
} as const;

type RawCard = Omit<StartupCard, "tags" | "colorSlot"> & {
  tags: { tag: TagRef | null }[];
};

function toCard(r: RawCard): StartupCard {
  const tagRefs = flattenTags(r.tags);
  return { ...r, tags: tagRefs, colorSlot: primarySlot(tagRefs) };
}

function startupWhere(f: StartupFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (f.status) {
    clauses.push(eq(startups.status, f.status as StartupCard["status"]));
  }
  if (f.sector) {
    clauses.push(inArray(startups.id, startupIdsInSector(f.sector)));
  }

  return clauses.length ? and(...clauses) : undefined;
}

async function fetchStartups(f: StartupFilters) {
  const page = f.page ?? 1;
  const where = startupWhere(f);

  // "raised" is deliberately absent: ordering by total capital means a
  // correlated SUM over funding_rounds, and the sum is only ever the
  // *disclosed* subtotal, so the ranking would silently punish companies whose
  // rounds were undisclosed. Name and recency are honest orderings.
  const orderBy =
    f.sort === "name"
      ? [asc(startups.name)]
      : [desc(startups.createdAt), desc(startups.id)];

  const [rows, total] = await Promise.all([
    db.query.startups.findMany({
      ...CARD_SELECT,
      where,
      orderBy,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.$count(startups, where),
  ]);

  return {
    rows: (rows as RawCard[]).map(toCard),
    total,
    pageCount: pageCount(total),
  };
}

export const listStartups = cached(fetchStartups, ["startups-list"], [
  CACHE_TAGS.startups,
  CACHE_TAGS.tags,
]);

export type StartupDetail = StartupCard & {
  description: string | null;
  website: string | null;
  hqState: string | null;
  foundedYear: number | null;
  employeeRange: string | null;
  sourceUrls: string[] | null;
  founders: { slug: string; name: string; role: string | null; linkedin: string | null }[];
  innovations: {
    id: number;
    title: string;
    description: string | null;
    type: (typeof innovationTypeEnum.enumValues)[number];
    launchDate: string | null;
    sourceUrl: string | null;
    githubUrl: string | null;
    arxivUrl: string | null;
    huggingfaceUrl: string | null;
  }[];
  shutdown: {
    shutdownDate: string | null;
    causeTags: string[];
    story: string | null;
    lessons: string | null;
    totalRaisedUsd: number | null;
    sourceUrl: string | null;
  } | null;
  rounds: RoundRow[];
};

async function fetchStartupBySlug(slug: string): Promise<StartupDetail | null> {
  const row = await db.query.startups.findFirst({
    columns: {
      ...STARTUP_CARD_COLUMNS,
      description: true,
      website: true,
      hqState: true,
      foundedYear: true,
      employeeRange: true,
      sourceUrls: true,
    },
    where: eq(startups.slug, slug),
    with: {
      tags: {
        columns: {},
        with: { tag: { columns: { slug: true, label: true, colorSlot: true } } },
      },
      founders: {
        columns: { role: true },
        with: {
          founder: { columns: { slug: true, name: true, linkedin: true } },
        },
      },
      innovations: {
        columns: {
          id: true,
          title: true,
          description: true,
          type: true,
          launchDate: true,
          sourceUrl: true,
          githubUrl: true,
          arxivUrl: true,
          huggingfaceUrl: true,
        },
      },
      shutdown: {
        columns: {
          shutdownDate: true,
          causeTags: true,
          story: true,
          lessons: true,
          totalRaisedUsd: true,
          sourceUrl: true,
        },
      },
    },
  });

  if (!row) return null;

  // Rounds are a second query rather than another `with`: they need the
  // investor join, and nesting three levels under one relational query
  // produces a noticeably slower plan than two concurrent statements.
  const rounds = await getRoundsForStartup(row.id);
  const tagRefs = flattenTags(row.tags as { tag: TagRef | null }[]);

  return {
    ...row,
    tags: tagRefs,
    colorSlot: primarySlot(tagRefs),
    founders: (row.founders as { role: string | null; founder: { slug: string; name: string; linkedin: string | null } | null }[])
      .filter((f) => f.founder !== null)
      .map((f) => ({
        slug: f.founder!.slug,
        name: f.founder!.name,
        role: f.role,
        linkedin: f.founder!.linkedin,
      })),
    shutdown: row.shutdown ?? null,
    rounds,
  };
}

export const getStartupBySlug = cached(
  fetchStartupBySlug,
  ["startup-detail"],
  [CACHE_TAGS.startups, CACHE_TAGS.rounds, CACHE_TAGS.shutdowns],
  DETAIL_TTL,
);

/**
 * Slugs to prerender at build time.
 *
 * Deliberately a *subset*, not everything: `dynamicParams` stays at its
 * default `true`, so a company ingested after the last build renders on first
 * request and is cached from then on. Returning `[]` on failure keeps a
 * database blip — or an unprovisioned one — from failing the whole build.
 */
export async function getStartupSlugs(limit = 50): Promise<{ slug: string }[]> {
  try {
    return await db.query.startups.findMany({
      columns: { slug: true },
      orderBy: [desc(startups.updatedAt)],
      limit,
    });
  } catch {
    return [];
  }
}
