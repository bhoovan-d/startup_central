import type { Metadata } from "next";

import { chartVar } from "@/lib/chart-palette";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  EPISODES,
  PODCAST_LINKS,
  PUBLISHED_EPISODES,
  formatDuration,
  formatEpisodeDate,
  formatTotalRuntime,
  youtubeUrl,
} from "@/lib/podcast-data";

/** The layout's `%s · Startup Central` template completes this. */
export const metadata: Metadata = {
  title: "Podcast",
  description:
    "Long-form conversations with the founders behind India's AI rounds — and behind the shutdowns.",
};

const upcoming = EPISODES.filter((e) => e.status === "coming_soon");

const totalRuntime = PUBLISHED_EPISODES.reduce(
  (sum, e) => sum + (e.durationSeconds ?? 0),
  0,
);

const companiesFeatured = new Set(
  PUBLISHED_EPISODES.map((e) => e.guest.company),
).size;

export default function PodcastPage() {
  return (
    <>
      <SiteHeader active="podcast" />

      <main className="flex-1">
        {/* ---- Hero --------------------------------------------------------- */}
        <section className="border-b-[3px] py-14">
          <div className="shell">
            <p className="eyebrow mb-5">The Startup Central Podcast</p>
            <h1 className="display max-w-4xl text-[clamp(2.25rem,6.5vw,5rem)] leading-[1.18]">
              Founders,
              <br />
              <span className="mark-block">on the record.</span>
            </h1>
            <p
              className="mt-7 max-w-xl text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Every fortnight we sit down with someone who built, funded or
              buried an Indian AI company — and ask the questions the press
              release skipped.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="link-block link-block--primary"
                href={PODCAST_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe on YouTube
              </a>
              <a
                className="link-block"
                href={PODCAST_LINKS.spotify}
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify
              </a>
              <a
                className="link-block"
                href={PODCAST_LINKS.apple}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Podcasts
              </a>
              <a
                className="link-block"
                href={PODCAST_LINKS.rss}
                target="_blank"
                rel="noopener noreferrer"
              >
                RSS
              </a>
            </div>
          </div>
        </section>

        {/* ---- Stat strip --------------------------------------------------- */}
        {/* Same conditional border logic as the homepage strip — those classes
            are what keep the left column flush with the hero headline. */}
        <section className="border-b-[3px]">
          <dl className="shell grid grid-cols-2 md:grid-cols-4">
            {[
              {
                k: "Episodes published",
                v: String(PUBLISHED_EPISODES.length),
                note: "since Apr 2026",
              },
              {
                k: "Total runtime",
                v: formatTotalRuntime(totalRuntime),
                note: "no filler",
              },
              {
                k: "Companies featured",
                v: String(companiesFeatured),
                note: "founders + operators",
              },
              { k: "Cadence", v: "14d", note: "every other Wednesday" },
            ].map((s, i) => (
              <div
                key={s.k}
                className={[
                  "py-7",
                  i % 2 === 0 ? "pr-5" : "border-l-[3px] pl-5 pr-5",
                  i > 0 ? "md:border-l-[3px] md:pl-5" : "",
                  i < 2 ? "border-b-[3px] md:border-b-0" : "",
                ].join(" ")}
              >
                <dt className="eyebrow mb-2.5">{s.k}</dt>
                <dd className="num text-4xl font-bold leading-none tracking-tight">
                  {s.v}
                </dd>
                <dd
                  className="num mt-2 text-[0.6875rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.note}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- Archive ------------------------------------------------------- */}
        <section className="py-14">
          <div className="shell">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-3xl">All episodes</h2>
              <span className="eyebrow">Newest first</span>
            </div>

            {/* Coming soon. Dashed hairline rule and no offset block, so it
                reads as unbuilt rather than merely differently coloured —
                status is never carried by colour alone. */}
            {upcoming.map((ep) => (
              <article
                key={ep.slug}
                className="mb-6 border-2 border-dashed p-5 sm:p-6"
                style={{ borderColor: "var(--rule-hairline)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <span
                    className="num text-3xl font-bold leading-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {String(ep.episodeNumber).padStart(2, "0")}
                  </span>
                  <h3
                    className="display min-w-0 flex-1 text-2xl"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {ep.title}
                  </h3>
                  <span className="tag" style={{ color: "var(--text-muted)" }}>
                    Coming soon
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {ep.guest.name}
                  </span>
                  <span
                    className="num text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {ep.guest.role}
                  </span>
                  <span
                    className="tag"
                    style={{ color: chartVar(ep.guest.colorSlot) }}
                  >
                    {ep.guest.company}
                  </span>
                </div>
                <p
                  className="mt-3 max-w-2xl text-sm leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {ep.description}
                </p>
              </article>
            ))}

            <ul className="flex flex-col gap-6">
              {PUBLISHED_EPISODES.map((ep) => (
                <li key={ep.slug}>
                  <article className="block-card grid gap-0 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0 p-5 sm:p-6">
                      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                        <span
                          className="num text-3xl font-bold leading-none"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {String(ep.episodeNumber).padStart(2, "0")}
                        </span>
                        <h3 className="display min-w-0 flex-1 text-2xl">
                          {ep.title}
                        </h3>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-sm font-semibold">
                          {ep.guest.name}
                        </span>
                        <span
                          className="num text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {ep.guest.role}
                        </span>
                        <span
                          className="tag"
                          style={{ color: chartVar(ep.guest.colorSlot) }}
                        >
                          {ep.guest.company}
                        </span>
                      </div>

                      <p
                        className="mt-3 max-w-2xl text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {ep.description}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {ep.youtubeId && (
                          <a
                            className="link-block"
                            href={youtubeUrl(ep.youtubeId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            YouTube
                          </a>
                        )}
                        {ep.spotifyUrl && (
                          <a
                            className="link-block"
                            href={ep.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Spotify
                          </a>
                        )}
                        {ep.appleUrl && (
                          <a
                            className="link-block"
                            href={ep.appleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Apple
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-8 border-t-[3px] p-5 sm:p-6 lg:min-w-40 lg:flex-col lg:gap-6 lg:border-l-[3px] lg:border-t-0">
                      <div>
                        <div className="eyebrow mb-1.5">Published</div>
                        {ep.publishedAt && (
                          <time
                            className="num text-sm font-semibold"
                            dateTime={ep.publishedAt}
                          >
                            {formatEpisodeDate(ep.publishedAt)}
                          </time>
                        )}
                      </div>
                      <div>
                        <div className="eyebrow mb-1.5">Runtime</div>
                        {ep.durationSeconds && (
                          <span className="num text-sm font-semibold">
                            {formatDuration(ep.durationSeconds)}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
