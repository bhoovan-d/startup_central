import { and, desc, eq, inArray, type SQL } from "drizzle-orm";

import { db, innovations } from "@/db";
import { PAGE_SIZE, pageCount } from "@/lib/params";

import { CACHE_TAGS, cached } from "./_cache";
import { flattenTags, primarySlot, startupIdsInSector, type TagRef } from "./_filters";

export type InnovationRow = {
  id: number;
  title: string;
  description: string | null;
  type: (typeof innovations.$inferSelect)["type"];
  launchDate: string | null;
  arxivUrl: string | null;
  githubUrl: string | null;
  huggingfaceUrl: string | null;
  sourceUrl: string | null;
  startup: { slug: string; name: string } | null;
  tags: TagRef[];
  colorSlot: number | null;
};

export type InnovationFilters = {
  type?: string;
  sector?: string;
  page?: number;
};

const INNOVATION_SELECT = {
  columns: {
    id: true,
    title: true,
    description: true,
    type: true,
    launchDate: true,
    arxivUrl: true,
    githubUrl: true,
    huggingfaceUrl: true,
    sourceUrl: true,
  },
  with: {
    startup: {
      columns: { slug: true, name: true },
      with: {
        tags: {
          columns: {},
          with: { tag: { columns: { slug: true, label: true, colorSlot: true } } },
        },
      },
    },
  },
} as const;

type RawInnovation = Omit<InnovationRow, "startup" | "tags" | "colorSlot"> & {
  startup: { slug: string; name: string; tags: { tag: TagRef | null }[] } | null;
};

function toInnovationRow(r: RawInnovation): InnovationRow {
  const tagRefs = flattenTags(r.startup?.tags);
  return {
    ...r,
    startup: r.startup ? { slug: r.startup.slug, name: r.startup.name } : null,
    tags: tagRefs,
    colorSlot: primarySlot(tagRefs),
  };
}

function innovationWhere(f: InnovationFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (f.type) {
    clauses.push(eq(innovations.type, f.type as InnovationRow["type"]));
  }
  if (f.sector) {
    clauses.push(inArray(innovations.startupId, startupIdsInSector(f.sector)));
  }

  return clauses.length ? and(...clauses) : undefined;
}

async function fetchInnovations(f: InnovationFilters) {
  const page = f.page ?? 1;
  const where = innovationWhere(f);

  const [rows, total] = await Promise.all([
    db.query.innovations.findMany({
      ...INNOVATION_SELECT,
      where,
      // `launch_date` is nullable — an undated innovation sorts last rather
      // than first, which is what `nulls last` on a DESC order requires
      // spelling out.
      orderBy: [desc(innovations.launchDate), desc(innovations.id)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.$count(innovations, where),
  ]);

  return {
    rows: (rows as RawInnovation[]).map(toInnovationRow),
    total,
    pageCount: pageCount(total),
  };
}

export const listInnovations = cached(fetchInnovations, ["innovations-list"], [
  CACHE_TAGS.innovations,
  CACHE_TAGS.startups,
]);
