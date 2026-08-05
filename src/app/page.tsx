import Link from "next/link";

import { SITE } from "@/lib/site";
import { CHART_PALETTE_LIGHT, chartVar } from "@/lib/chart-palette";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  PUBLISHED_EPISODES,
  formatDuration,
  formatEpisodeDate,
  youtubeUrl,
} from "@/lib/podcast-data";

/**
 * DESIGN PROOF PAGE.
 *
 * Exercises the Ink & Marigold system end to end: display type, the stat
 * strip, a dense mono funding table, cause tags, and all 8 validated chart
 * slots. The content below is illustrative sample data for design review —
 * it does not come from the database and is not a factual record.
 */

const SECTORS = [
  "GenAI",
  "Vision",
  "Speech",
  "Agents",
  "Infra",
  "Health AI",
  "Fintech AI",
  "Other",
] as const;

const SAMPLE_ROUNDS = [
  { co: "Sarvam AI", round: "Series B", amt: 41_000_000, date: "2026-07-22", lead: "Lightspeed", slot: 0 },
  { co: "Krutrim", round: "Series A", amt: 50_000_000, date: "2026-07-18", lead: "Matrix", slot: 0 },
  { co: "Observe.AI", round: "Series D", amt: 125_000_000, date: "2026-07-11", lead: "SoftBank", slot: 2 },
  { co: "Pixis", round: "Series C", amt: 85_000_000, date: "2026-07-04", lead: "Touring Capital", slot: 3 },
  { co: "Neysa Networks", round: "Series A", amt: 30_000_000, date: "2026-06-27", lead: "NTTVC", slot: 4 },
  { co: "CoRover", round: "Seed", amt: 4_500_000, date: "2026-06-19", lead: "Undisclosed", slot: 1 },
];

const SAMPLE_GRAVEYARD = [
  { co: "BluSmart", raised: 180_000_000, when: "Apr 2025", causes: ["Governance"] },
  { co: "Hike Rush", raised: 261_000_000, when: "Sep 2025", causes: ["Regulatory"] },
  { co: "Otipy", raised: 42_000_000, when: "May 2025", causes: ["Capital crunch"] },
  { co: "subtl.ai", raised: 1_200_000, when: "Nov 2025", causes: ["No PMF", "Capital crunch"] },
];

function usd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

export default function Home() {
  const [featured, ...rest] = PUBLISHED_EPISODES;
  const recent = rest.slice(0, 3);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---- Hero --------------------------------------------------------- */}
        <section className="border-b-[3px] py-14">
          <div className="shell">
            <p className="eyebrow mb-5">Est. 2026 · Updated daily</p>
            <h1 className="display max-w-4xl text-[clamp(2.25rem,6.5vw,5rem)] leading-[1.18]">
              India&apos;s AI startups.
              <br />
              <span className="mark-block">Funded, shipped,</span>
              <br />
              and buried.
            </h1>
            <p
              className="mt-7 max-w-xl text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {SITE.description}
            </p>
          </div>
        </section>

        {/* ---- Stat strip --------------------------------------------------- */}
        <section className="border-b-[3px]">
          <dl className="shell grid grid-cols-2 md:grid-cols-4">
            {[
              { k: "Companies tracked", v: "174", note: "AI-first, India HQ" },
              { k: "Capital raised", v: "$2.61B", note: "since 2020" },
              { k: "Rounds this month", v: "12", note: "+3 vs last" },
              { k: "In the graveyard", v: "29", note: "with post-mortems" },
            ].map((s, i) => (
              <div
                key={s.k}
                className={[
                  "py-7",
                  // Cells in the left column hug the gutter, so their labels line
                  // up with the hero headline. Others sit inset past their rule.
                  i % 2 === 0 ? "pr-5" : "border-l-[3px] pl-5 pr-5",
                  // At 4-up, everything except the first cell gains a rule.
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

        {/* ---- Funding + Graveyard ------------------------------------------ */}
        <section className="shell grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr]">
          {/* Funding table */}
          {/* min-w-0: grid children default to min-width:auto, which makes them
              refuse to shrink below the table's intrinsic width — the card's
              overflow-x-auto then never engages and the page scrolls sideways. */}
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-3xl">Latest rounds</h2>
              <span className="eyebrow">Week of 20 Jul 2026</span>
            </div>

            <div className="block-card overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Round</th>
                    <th className="text-right">Amount</th>
                    <th>Lead</th>
                    <th className="text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROUNDS.map((r) => (
                    <tr key={r.co}>
                      <td className="whitespace-nowrap font-semibold">
                        <span
                          aria-hidden
                          className="mr-2 inline-block h-2 w-2 align-middle"
                          style={{ background: chartVar(r.slot) }}
                        />
                        {r.co}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{r.round}</td>
                      <td className="num text-right font-semibold">{usd(r.amt)}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{r.lead}</td>
                      <td
                        className="num text-right"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {r.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Graveyard */}
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                className="display text-3xl"
                style={{ color: "var(--color-vermillion)" }}
              >
                Graveyard
              </h2>
              <span className="eyebrow">2025—26</span>
            </div>

            <ul className="flex flex-col gap-3">
              {SAMPLE_GRAVEYARD.map((g) => (
                <li key={g.co} className="block-card-sm p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="display text-xl">{g.co}</span>
                    <span
                      className="num text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {g.when}
                    </span>
                  </div>
                  <div
                    className="num mt-1 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {usd(g.raised)} raised
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {g.causes.map((c) => (
                      <span
                        key={c}
                        className="tag"
                        style={{ color: "var(--color-vermillion)" }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Sector palette proof ------------------------------------------ */}
        <section className="border-t-[3px] py-14">
          <div className="shell">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="display text-3xl">By sector</h2>
              <span className="eyebrow">8 slots · validated</span>
            </div>
            <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
              Colour follows the company, never its rank — filtering never
              repaints the survivors. A 9th sector folds into &ldquo;Other&rdquo;.
            </p>

            {/* Stacked bar. The 2px surface gap between fills is mandatory
                secondary encoding, not decoration. */}
            <div className="mb-5 flex h-11 w-full">
              {SECTORS.map((s, i) => (
                <div
                  key={s}
                  className="h-full"
                  style={{
                    background: chartVar(i),
                    flex: [28, 18, 12, 14, 10, 8, 6, 4][i],
                    marginRight: i < SECTORS.length - 1 ? 2 : 0,
                  }}
                  title={s}
                />
              ))}
            </div>

            {/* Legend — identity is never colour-alone. */}
            <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
              {SECTORS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 rounded-xs"
                    style={{ background: chartVar(i) }}
                  />
                  <span className="num text-xs">{s}</span>
                  <span
                    className="num text-[0.625rem]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {CHART_PALETTE_LIGHT[i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Podcast ------------------------------------------------------- */}
        {/* Episodes are catalogue entries, not media cards: the number is the
            loud element, the way a label numbers a release. */}
        <section className="border-t-[3px] py-14" style={{ background: "var(--surface)" }}>
          <div className="shell">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-3xl">The Podcast</h2>
              <span className="eyebrow">
                {PUBLISHED_EPISODES.length} episodes · fortnightly
              </span>
            </div>
            <p className="mb-7 max-w-xl text-sm" style={{ color: "var(--text-secondary)" }}>
              Long-form conversations with the founders behind the rounds — and
              behind the shutdowns. No pitch decks, no hype cycle.
            </p>

            {/* Featured episode */}
            <article className="block-card grid gap-0 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0 p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="eyebrow" style={{ color: "var(--color-marigold)" }}>
                    Latest
                  </span>
                  <span
                    aria-hidden
                    className="h-px flex-1"
                    style={{ background: "var(--rule-hairline)" }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <span
                    className="num text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-none tracking-tight"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {String(featured.episodeNumber).padStart(2, "0")}
                  </span>
                  <h3 className="display min-w-0 flex-1 text-[clamp(1.5rem,3vw,2.25rem)]">
                    {featured.title}
                  </h3>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-semibold">
                    {featured.guest.name}
                  </span>
                  <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                    {featured.guest.role}
                  </span>
                  <span
                    className="tag"
                    style={{ color: chartVar(featured.guest.colorSlot) }}
                  >
                    {featured.guest.company}
                  </span>
                </div>

                <p
                  className="mt-4 max-w-lg text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {featured.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {featured.youtubeId && (
                    <a
                      className="link-block link-block--primary"
                      href={youtubeUrl(featured.youtubeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch on YouTube
                    </a>
                  )}
                  {featured.spotifyUrl && (
                    <a
                      className="link-block"
                      href={featured.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Spotify
                    </a>
                  )}
                  {featured.appleUrl && (
                    <a
                      className="link-block"
                      href={featured.appleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Apple
                    </a>
                  )}
                </div>
              </div>

              {/* Right rail: the metadata, ruled off like a colophon. */}
              <div className="flex gap-8 border-t-[3px] p-6 sm:p-7 lg:min-w-44 lg:flex-col lg:gap-7 lg:border-l-[3px] lg:border-t-0">
                <div>
                  <div className="eyebrow mb-1.5">Published</div>
                  {featured.publishedAt && (
                    <time
                      className="num text-sm font-semibold"
                      dateTime={featured.publishedAt}
                    >
                      {formatEpisodeDate(featured.publishedAt)}
                    </time>
                  )}
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Runtime</div>
                  {featured.durationSeconds && (
                    <span className="num text-sm font-semibold">
                      {formatDuration(featured.durationSeconds)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Episode</div>
                  <span className="num text-sm font-semibold">
                    {String(featured.episodeNumber).padStart(2, "0")} /{" "}
                    {String(PUBLISHED_EPISODES.length).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </article>

            {/* Recent episodes */}
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {recent.map((ep) => (
                <li key={ep.slug} className="block-card-sm min-w-0 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="num text-2xl font-bold leading-none"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {String(ep.episodeNumber).padStart(2, "0")}
                    </span>
                    {ep.durationSeconds && (
                      <span
                        className="num text-[0.625rem]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatDuration(ep.durationSeconds)}
                      </span>
                    )}
                  </div>
                  <h4 className="display mt-3 text-lg leading-[1.05]">
                    {ep.title}
                  </h4>
                  <div className="mt-3">
                    <span
                      className="tag"
                      style={{ color: chartVar(ep.guest.colorSlot) }}
                    >
                      {ep.guest.company}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <Link className="link-block" href="/podcast">
                All episodes →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
