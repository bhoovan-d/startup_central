import { eq } from "drizzle-orm";

import { db, startupTags, tags } from "@/db";

/**
 * "startups carrying this tag", as a subquery.
 *
 * Drizzle's relational queries can't filter a parent by a property of a
 * related table, so every `?sector=` filter on the site resolves through this
 * instead of a join — `where(inArray(x.startupId, startupIdsInSector(slug)))`.
 *
 * An unknown slug matches nothing and yields an empty list, which is the
 * correct answer for a hand-typed URL rather than an error.
 */
export function startupIdsInSector(slug: string) {
  return db
    .select({ id: startupTags.startupId })
    .from(startupTags)
    .innerJoin(tags, eq(tags.id, startupTags.tagId))
    .where(eq(tags.slug, slug));
}

/**
 * The columns every list needs off `startups`.
 *
 * Spelled out on purpose: `startups.searchVector` is a real column on the
 * Drizzle table object, so an unqualified select drags a full tsvector over
 * the wire for every row of every list. Passing `columns` explicitly is the
 * only thing that prevents it.
 */
export const STARTUP_CARD_COLUMNS = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  status: true,
  hqCity: true,
  verified: true,
} as const;

/** The tag include, flattened by callers to `{ label, colorSlot }`. */
export const TAG_INCLUDE = {
  columns: {},
  with: {
    tag: { columns: { slug: true, label: true, colorSlot: true } },
  },
} as const;

export type TagRef = { slug: string; label: string; colorSlot: number | null };

export function flattenTags(
  rows: { tag: TagRef | null }[] | undefined,
): TagRef[] {
  return (rows ?? []).map((r) => r.tag).filter((t): t is TagRef => t !== null);
}

/**
 * The colour a row is drawn in: its first tag's slot, or null when untagged.
 * Null means "draw it in ink", never "pick slot 0" — an untagged company must
 * not borrow GenAI's colour.
 */
export function primarySlot(tagRefs: TagRef[]): number | null {
  return tagRefs[0]?.colorSlot ?? null;
}
