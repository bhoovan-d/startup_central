import { asc } from "drizzle-orm";

import { db, tags } from "@/db";

import { CACHE_TAGS, cached } from "./_cache";
import type { TagRef } from "./_filters";

/**
 * The sector taxonomy, for the filter chips.
 *
 * Ordered by `color_slot` so the chips appear in the same order as the legend
 * on the sector bar — colour follows the entity, and so does its position.
 */
async function fetchTags(): Promise<TagRef[]> {
  return db.query.tags.findMany({
    columns: { slug: true, label: true, colorSlot: true },
    orderBy: [asc(tags.colorSlot), asc(tags.slug)],
  });
}

export const listTags = cached(fetchTags, ["tags-list"], [CACHE_TAGS.tags]);
