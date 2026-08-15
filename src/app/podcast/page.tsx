import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { EpisodeRowCard, UpcomingEpisode } from "@/components/episode-card";
import { SectionHeading } from "@/components/section-heading";
import { StatStrip, type Stat } from "@/components/stat-strip";
import { formatTotalRuntime } from "@/lib/format";
import {
  PODCAST_LINKS,
  getPublishedEpisodes,
  getUpcomingEpisodes,
  podcastStats,
} from "@/lib/queries/podcast";

/** The layout's `%s · Startup Central` template completes this. */
export const metadata: Metadata = {
  title: "Podcast",
  description:
    "Long-form conversations with the founders behind India's AI rounds — and behind the shutdowns.",
};

/** Per request, cached at the query layer — see the note on the homepage. */
export const dynamic = "force-dynamic";

/**
 * The episode archive.
 *
 * Every episode here comes from the `podcast_episodes` table. This page used
 * to render a static array that marked seven episodes "published" — with
 * invented conversations attributed to real, named people and a placeholder
 * video id on all of them. None of that survived the move to the database:
 * an episode exists here only once it exists in fact.
 */
export default async function PodcastPage() {
  const [published, upcoming] = await Promise.all([
    getPublishedEpisodes(),
    getUpcomingEpisodes(),
  ]);

  const stats = podcastStats(published);

  // The subscribe row only shows platforms that have actually been set up.
  // A dead link to a show that doesn't exist yet is its own small lie.
  const links = [
    { href: PODCAST_LINKS.youtube, label: "Subscribe on YouTube", primary: true },
    { href: PODCAST_LINKS.spotify, label: "Spotify", primary: false },
    { href: PODCAST_LINKS.apple, label: "Apple Podcasts", primary: false },
  ].filter((l): l is { href: string; label: string; primary: boolean } =>
    Boolean(l.href),
  );

  const items: Stat[] = [
    { k: "Episodes published", v: String(stats.episodes) },
    {
      k: "Total runtime",
      v: stats.totalRuntimeSeconds > 0 ? formatTotalRuntime(stats.totalRuntimeSeconds) : "—",
      note: stats.totalRuntimeSeconds > 0 ? "no filler" : null,
    },
    { k: "Companies featured", v: String(stats.companiesFeatured) },
    { k: "Scheduled", v: String(upcoming.length), note: upcoming.length > 0 ? "recording" : null },
  ];

  return (
    <>
      {/* ---- Hero ------------------------------------------------------------ */}
      <section className="border-b-[3px] py-14">
        <div className="shell">
          <p className="eyebrow mb-5">The Startup Central Podcast</p>
          <h1 className="display max-w-4xl text-[clamp(2.25rem,6.5vw,5rem)] leading-[1.18]">
            Founders,
            <br />
            <span className="mark-block">on the record.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Conversations with the people who built, funded or buried an Indian
            startup — and the questions the press release skipped.
          </p>

          {links.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {links.map((l) => (
                <a
                  key={l.label}
                  className={l.primary ? "link-block link-block--primary" : "link-block"}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <StatStrip items={items} />

      {/* ---- Archive --------------------------------------------------------- */}
      <section className="py-14">
        <div className="shell">
          <SectionHeading title="All episodes" aside="Newest first" />

          {upcoming.map((ep) => (
            <UpcomingEpisode key={ep.slug} episode={ep} />
          ))}

          {published.length === 0 ? (
            <EmptyState
              title="No episodes published yet"
              detail="The first conversation is still being recorded. Episodes are listed here once they exist — not before."
            />
          ) : (
            <ul className="flex flex-col gap-6">
              {published.map((ep) => (
                <li key={ep.slug}>
                  <EpisodeRowCard episode={ep} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
