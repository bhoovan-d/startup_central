import { Suspense } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/empty-state";
import { EpisodeStrip, FeaturedEpisode } from "@/components/episode-card";
import { GraveyardCard } from "@/components/graveyard-card";
import { RoundsTable } from "@/components/rounds-table";
import { SectionHeading } from "@/components/section-heading";
import { SectorBar } from "@/components/sector-bar";
import { StatStrip, type Stat } from "@/components/stat-strip";
import { formatTimestamp, inr, usd } from "@/lib/format";
import { getRecentRounds } from "@/lib/queries/funding";
import { getRecentShutdowns } from "@/lib/queries/graveyard";
import { getPublishedEpisodes } from "@/lib/queries/podcast";
import { getLastUpdated, getSectorBreakdown, getSiteStats } from "@/lib/queries/stats";
import { SITE } from "@/lib/site";

/**
 * The homepage.
 *
 * Everything below reads from Postgres. On an empty database it renders zeros
 * and dashed empty states rather than plausible-looking sample rows — which is
 * the whole point: the numbers here are either true or absent.
 *
 * Each data block is its own async component behind `<Suspense>`, so the hero
 * and section rules paint immediately instead of waiting on Neon.
 */

/**
 * Rendered per request rather than prerendered at build.
 *
 * The caching that matters happens a layer down: every query here is wrapped
 * in `unstable_cache` with a 15-minute TTL and an ingest-invalidated tag, so a
 * request costs a React render, not a round trip to Neon. Giving up the
 * build-time HTML buys two things worth more than that render:
 *
 *  - `next build` no longer needs a reachable database. A deploy can't be
 *    taken down by a Neon blip, and the repo builds before one is provisioned.
 *  - A database outage degrades to per-block error boundaries instead of a
 *    stale page or a failed deploy.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---- Hero --------------------------------------------------------- */}
        <section className="border-b-[3px] py-14">
          <div className="shell">
            <Suspense fallback={<p className="eyebrow mb-5">&nbsp;</p>}>
              <LastUpdatedEyebrow />
            </Suspense>
            <h1 className="display max-w-4xl text-[clamp(2.25rem,6.5vw,5rem)] leading-[1.18]">
              India&apos;s startups.
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
        <Suspense fallback={<StatStripSkeleton />}>
          <SiteStats />
        </Suspense>

        {/* ---- Funding + Graveyard ------------------------------------------ */}
        <section className="shell grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr]">
          {/* min-w-0: grid children default to min-width:auto, which makes them
              refuse to shrink below the table's intrinsic width — the card's
              overflow-x-auto then never engages and the page scrolls sideways. */}
          <div className="min-w-0">
            <SectionHeading title="Latest rounds" aside="Newest first" />
            <Suspense fallback={<BlockSkeleton />}>
              <LatestRounds />
            </Suspense>
            <div className="mt-5">
              <Link className="link-block" href="/funding">
                All funding →
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <SectionHeading title="Graveyard" aside="With post-mortems" tone="vermillion" />
            <Suspense fallback={<BlockSkeleton />}>
              <RecentGraveyard />
            </Suspense>
            <div className="mt-5">
              <Link className="link-block" href="/graveyard">
                All shutdowns →
              </Link>
            </div>
          </div>
        </section>

        {/* ---- By sector ----------------------------------------------------- */}
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
            <Suspense fallback={<BlockSkeleton />}>
              <Sectors />
            </Suspense>
          </div>
        </section>

        {/* ---- Podcast ------------------------------------------------------- */}
        {/* Episodes are catalogue entries, not media cards: the number is the
            loud element, the way a label numbers a release. */}
        <section className="border-t-[3px] py-14" style={{ background: "var(--surface)" }}>
          <div className="shell">
            <Suspense fallback={<BlockSkeleton />}>
              <PodcastSection />
            </Suspense>
          </div>
        </section>
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Data blocks                                                                 */
/* -------------------------------------------------------------------------- */

async function LastUpdatedEyebrow() {
  const last = await getLastUpdated();
  return (
    <p className="eyebrow mb-5">
      {last ? `Last updated ${formatTimestamp(last)}` : "No records yet"}
    </p>
  );
}

async function SiteStats() {
  const s = await getSiteStats();

  // "Capital raised" is the *disclosed USD* subtotal and is labelled as such.
  // Rounds reported only in rupees are counted on the note line instead of
  // being converted — applying an exchange rate would turn a reported figure
  // into an invented one.
  const capitalNote = s.capitalInrOnly > 0
    ? `disclosed · plus ${inr(s.capitalInrOnly)}`
    : "disclosed only";

  const items: Stat[] = [
    { k: "Companies tracked", v: String(s.companies), note: "India HQ" },
    { k: "Capital raised", v: usd(s.capitalUsd) ?? "$0", note: capitalNote },
    {
      k: "Rounds this month",
      v: String(s.roundsThisMonth),
      note: s.roundsDelta === 0 ? "level vs last" : `${s.roundsDelta > 0 ? "+" : ""}${s.roundsDelta} vs last`,
    },
    { k: "In the graveyard", v: String(s.graveyard), note: "with post-mortems" },
  ];

  return <StatStrip items={items} />;
}

async function LatestRounds() {
  const rows = await getRecentRounds(6);
  return <RoundsTable rows={rows} />;
}

async function RecentGraveyard() {
  const rows = await getRecentShutdowns(4);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No shutdowns recorded"
        detail="Post-mortems are written by hand, never extracted — a company's causes and lessons are our own words."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id}>
          <GraveyardCard row={r} />
        </li>
      ))}
    </ul>
  );
}

async function Sectors() {
  const slices = await getSectorBreakdown();
  return <SectorBar slices={slices} />;
}

async function PodcastSection() {
  const episodes = await getPublishedEpisodes();
  const [featured, ...rest] = episodes;

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-3xl">The Podcast</h2>
        <span className="eyebrow">
          {episodes.length} {episodes.length === 1 ? "episode" : "episodes"}
        </span>
      </div>
      <p className="mb-7 max-w-xl text-sm" style={{ color: "var(--text-secondary)" }}>
        Long-form conversations with the founders behind the rounds — and
        behind the shutdowns. No pitch decks, no hype cycle.
      </p>

      {featured ? (
        <>
          <FeaturedEpisode episode={featured} total={episodes.length} />
          <EpisodeStrip episodes={rest.slice(0, 3)} />
        </>
      ) : (
        <EmptyState
          title="No episodes published yet"
          detail="The first conversation is still being recorded. Nothing is listed here until it exists."
        />
      )}

      <div className="mt-7">
        <Link className="link-block" href="/podcast">
          All episodes →
        </Link>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Skeletons hold the rules and the height, and show nothing else. A shimmering
 * placeholder that resolves to "0" would be a small lie told twice.
 */
function StatStripSkeleton() {
  return (
    <section className="border-b-[3px]">
      <div className="shell h-[8.5rem]" />
    </section>
  );
}

function BlockSkeleton() {
  return <div className="h-40" />;
}
