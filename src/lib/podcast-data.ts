/**
 * Podcast episodes.
 *
 * Illustrative sample data for design review — these episodes, guests and
 * platform links are not real records and nothing here comes from the
 * database.
 *
 * The shape mirrors `podcastEpisodes` in src/db/schema.ts field-for-field, so
 * going live is a swap of the EPISODES const for a
 * `db.query.podcastEpisodes.findMany()` call — the render layer already reads
 * the schema's names. The one flattening is `guest`, which stands in for the
 * startupId / founderId joins.
 */

export type EpisodeStatus = "published" | "coming_soon";

export type Episode = {
  slug: string;
  episodeNumber: number;
  title: string;
  description: string;
  /** ISO date. Null until an episode actually ships. */
  publishedAt: string | null;
  youtubeId: string | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
  durationSeconds: number | null;
  status: EpisodeStatus;
  guest: {
    name: string;
    role: string;
    company: string;
    /**
     * Stable per-company palette slot — the company's colour, not its position
     * in this list. See the note in src/lib/chart-palette.ts.
     */
    colorSlot: number;
  };
};

/** Newest first. */
export const EPISODES: Episode[] = [
  {
    slug: "sarvam-ai-sovereign-models",
    episodeNumber: 8,
    title: "What a sovereign model actually costs",
    description:
      "Training in-country, the GPU import maths, and why the hard part was never the architecture.",
    publishedAt: null,
    youtubeId: null,
    spotifyUrl: null,
    appleUrl: null,
    durationSeconds: null,
    status: "coming_soon",
    guest: {
      name: "Vivek Raghavan",
      role: "Co-founder",
      company: "Sarvam AI",
      colorSlot: 0,
    },
  },
  {
    slug: "observe-ai-enterprise-wedge",
    episodeNumber: 7,
    title: "Selling AI to people who audit everything",
    description:
      "Eight years of enterprise contact-centre software, the Series D, and what changed the day GPT-4 shipped.",
    publishedAt: "2026-07-22",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 3480,
    status: "published",
    guest: {
      name: "Swapnil Jain",
      role: "CEO",
      company: "Observe.AI",
      colorSlot: 2,
    },
  },
  {
    slug: "krutrim-indic-languages",
    episodeNumber: 6,
    title: "Twenty-two languages, one tokenizer",
    description:
      "Why Indic scripts break every assumption in the standard pipeline, and what it took to fix the data layer first.",
    publishedAt: "2026-07-08",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 2940,
    status: "published",
    guest: {
      name: "Ravi Jain",
      role: "VP Engineering",
      company: "Krutrim",
      colorSlot: 0,
    },
  },
  {
    slug: "neysa-networks-gpu-cloud",
    episodeNumber: 5,
    title: "Building a GPU cloud from a standing start",
    description:
      "Racks, power contracts and utilisation curves — the least glamorous, most decisive infrastructure story in Indian AI.",
    publishedAt: "2026-06-24",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 3120,
    status: "published",
    guest: {
      name: "Sharad Sanghi",
      role: "Founder",
      company: "Neysa Networks",
      colorSlot: 4,
    },
  },
  {
    slug: "pixis-codeless-ai",
    episodeNumber: 4,
    title: "The pitch that stopped mentioning AI",
    description:
      "How a codeless marketing-AI company rewrote its entire go-to-market once every competitor started saying the same words.",
    publishedAt: "2026-06-10",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 2760,
    status: "published",
    guest: {
      name: "Shubham A. Mishra",
      role: "Co-founder",
      company: "Pixis",
      colorSlot: 3,
    },
  },
  {
    slug: "corover-bharatgpt-scale",
    episodeNumber: 3,
    title: "Ten million conversations on the railways",
    description:
      "Serving a conversational assistant to a user base that is mostly on 4G, mostly not in English, and mostly not forgiving.",
    publishedAt: "2026-05-27",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 2580,
    status: "published",
    guest: {
      name: "Ankush Sabharwal",
      role: "Founder",
      company: "CoRover",
      colorSlot: 1,
    },
  },
  {
    slug: "the-graveyard-postmortem",
    episodeNumber: 2,
    title: "A post-mortem, told by the founder",
    description:
      "Ninety million raised, four years, and a shutdown notice. An unusually candid account of where the money actually went.",
    publishedAt: "2026-05-13",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 3300,
    status: "published",
    guest: {
      name: "Anonymous",
      role: "Former CEO",
      company: "Withheld",
      colorSlot: 7,
    },
  },
  {
    slug: "why-we-are-counting",
    episodeNumber: 1,
    title: "Why we started counting",
    description:
      "The first episode. What a structured record of the ecosystem is for, and why the shutdowns matter as much as the rounds.",
    publishedAt: "2026-04-29",
    youtubeId: "dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/startup-central",
    appleUrl: "https://podcasts.apple.com/podcast/startup-central",
    durationSeconds: 1980,
    status: "published",
    guest: {
      name: "The editors",
      role: "Startup Central",
      company: "In-house",
      colorSlot: 5,
    },
  },
];

/** Where the show itself lives, for the subscribe row. */
export const PODCAST_LINKS = {
  youtube: "https://youtube.com/@startupcentral",
  spotify: "https://open.spotify.com/show/startup-central",
  apple: "https://podcasts.apple.com/podcast/startup-central",
  rss: "https://startupcentral.in/podcast/rss.xml",
} as const;

export const PUBLISHED_EPISODES = EPISODES.filter(
  (e) => e.status === "published",
);

export function youtubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** "48 MIN" — episode runtimes are never precise enough to warrant seconds. */
export function formatDuration(seconds: number): string {
  return `${Math.round(seconds / 60)} MIN`;
}

/** "3 HR 12 MIN", for the aggregate runtime stat. */
export function formatTotalRuntime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/**
 * "22 JUL 2026".
 *
 * Parsed and formatted by hand rather than through Date/toLocaleDateString:
 * both are sensitive to the runtime's timezone and locale, so the server and
 * the browser can disagree on the day and React reports a hydration mismatch.
 * The input is a plain ISO date, so a split is all this needs.
 */
export function formatEpisodeDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}
