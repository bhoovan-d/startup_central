import { asc, desc, eq } from "drizzle-orm";

import { db, podcastEpisodes } from "@/db";
import type { Timestamplike } from "@/lib/format";

import { CACHE_TAGS, cached } from "./_cache";
import { flattenTags, primarySlot, type TagRef } from "./_filters";

export type EpisodeRow = {
  id: number;
  slug: string;
  episodeNumber: number | null;
  title: string;
  description: string | null;
  /**
   * timestamptz. A `Date` on a cache miss, an ISO string on a hit — these
   * queries are memoised and `unstable_cache` serialises through JSON.
   * Always format it through `formatTimestamp`, which accepts both.
   */
  publishedAt: Timestamplike;
  youtubeId: string | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
  durationSeconds: number | null;
  status: (typeof podcastEpisodes.$inferSelect)["status"];
  guest: { name: string; slug: string } | null;
  company: { name: string; slug: string } | null;
  /**
   * The company's sector colour. Null when no startup is linked — an episode
   * without a company is drawn in ink rather than borrowing slot 0.
   */
  colorSlot: number | null;
  tags: TagRef[];
};

const EPISODE_SELECT = {
  columns: {
    id: true,
    slug: true,
    episodeNumber: true,
    title: true,
    description: true,
    publishedAt: true,
    youtubeId: true,
    spotifyUrl: true,
    appleUrl: true,
    durationSeconds: true,
    status: true,
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
    founder: { columns: { slug: true, name: true } },
  },
} as const;

type RawEpisode = Omit<EpisodeRow, "guest" | "company" | "colorSlot" | "tags"> & {
  startup: { slug: string; name: string; tags: { tag: TagRef | null }[] } | null;
  founder: { slug: string; name: string } | null;
};

function toEpisodeRow(r: RawEpisode): EpisodeRow {
  const tagRefs = flattenTags(r.startup?.tags);
  return {
    id: r.id,
    slug: r.slug,
    episodeNumber: r.episodeNumber,
    title: r.title,
    description: r.description,
    publishedAt: r.publishedAt,
    youtubeId: r.youtubeId,
    spotifyUrl: r.spotifyUrl,
    appleUrl: r.appleUrl,
    durationSeconds: r.durationSeconds,
    status: r.status,
    guest: r.founder ? { slug: r.founder.slug, name: r.founder.name } : null,
    company: r.startup ? { slug: r.startup.slug, name: r.startup.name } : null,
    colorSlot: primarySlot(tagRefs),
    tags: tagRefs,
  };
}

async function fetchPublishedEpisodes(): Promise<EpisodeRow[]> {
  const rows = await db.query.podcastEpisodes.findMany({
    ...EPISODE_SELECT,
    where: eq(podcastEpisodes.status, "published"),
    orderBy: [desc(podcastEpisodes.publishedAt), desc(podcastEpisodes.episodeNumber)],
  });
  return (rows as RawEpisode[]).map(toEpisodeRow);
}

export const getPublishedEpisodes = cached(
  fetchPublishedEpisodes,
  ["episodes-published"],
  [CACHE_TAGS.episodes],
);

async function fetchUpcomingEpisodes(): Promise<EpisodeRow[]> {
  const rows = await db.query.podcastEpisodes.findMany({
    ...EPISODE_SELECT,
    where: eq(podcastEpisodes.status, "coming_soon"),
    orderBy: [asc(podcastEpisodes.episodeNumber)],
  });
  return (rows as RawEpisode[]).map(toEpisodeRow);
}

export const getUpcomingEpisodes = cached(
  fetchUpcomingEpisodes,
  ["episodes-upcoming"],
  [CACHE_TAGS.episodes],
);

export type PodcastStats = {
  episodes: number;
  totalRuntimeSeconds: number;
  companiesFeatured: number;
};

/**
 * Derived from the published episodes rather than queried separately — the
 * list is small enough that a second round trip to Neon would cost more than
 * the arithmetic.
 */
export function podcastStats(episodes: EpisodeRow[]): PodcastStats {
  return {
    episodes: episodes.length,
    totalRuntimeSeconds: episodes.reduce((n, e) => n + (e.durationSeconds ?? 0), 0),
    companiesFeatured: new Set(
      episodes.map((e) => e.company?.slug).filter(Boolean),
    ).size,
  };
}

/** Where the show itself lives. Env-overridable, absent until it is real. */
export const PODCAST_LINKS = {
  youtube: process.env.NEXT_PUBLIC_PODCAST_YOUTUBE,
  spotify: process.env.NEXT_PUBLIC_PODCAST_SPOTIFY,
  apple: process.env.NEXT_PUBLIC_PODCAST_APPLE,
} as const;
