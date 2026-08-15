import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CauseTags } from "@/components/graveyard-card";
import { RoundsTable } from "@/components/rounds-table";
import { SectionHeading } from "@/components/section-heading";
import { SourceLink, TagPills, UnverifiedTag } from "@/components/provenance";
import {
  INNOVATION_LABELS,
  STATUS_LABELS,
  formatDbDate,
  usd,
} from "@/lib/format";
import { getStartupBySlug, getStartupSlugs } from "@/lib/queries/startups";

export const revalidate = 3600;

/**
 * Prerender the most recently updated companies, and leave `dynamicParams` at
 * its default `true` so anything ingested since the last build still renders
 * on first request. Setting it to `false` would 404 every new company until
 * the next deploy.
 */
export async function generateStaticParams() {
  return getStartupSlugs(50);
}

export async function generateMetadata({
  params,
}: PageProps<"/startups/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const startup = await getStartupBySlug(slug);
  if (!startup) return { title: "Not found" };

  return {
    title: startup.name,
    description: startup.tagline ?? startup.description ?? undefined,
  };
}

export default async function Page({ params }: PageProps<"/startups/[slug]">) {
  // `params` is a Promise in Next 16. `getStartupBySlug` is wrapped in
  // `react.cache`, so the call `generateMetadata` already made is reused here
  // rather than costing a second round trip to Neon.
  const { slug } = await params;
  const startup = await getStartupBySlug(slug);

  if (!startup) notFound();

  const raised = startup.rounds.reduce((n, r) => n + (r.amountUsd ?? 0), 0);
  const hasUndisclosed = startup.rounds.some((r) => r.amountUsd === null);

  return (
    <article className="shell py-12">
      {/* ---- Identity ------------------------------------------------------ */}
      <header className="border-b-[3px] pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <TagPills tags={startup.tags} />
          <span className="tag" style={{ color: "var(--text-muted)" }}>
            {STATUS_LABELS[startup.status]}
          </span>
          <UnverifiedTag verified={startup.verified} />
        </div>

        <h1 className="display mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
          {startup.name}
        </h1>

        {startup.tagline ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {startup.tagline}
          </p>
        ) : null}

        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          <Fact label="HQ" value={[startup.hqCity, startup.hqState].filter(Boolean).join(", ")} />
          <Fact label="Founded" value={startup.foundedYear ? String(startup.foundedYear) : null} />
          <Fact label="Team" value={startup.employeeRange} />
          <Fact
            label="Disclosed raise"
            value={startup.rounds.length > 0 ? (usd(raised) ?? "Undisclosed") : null}
            note={hasUndisclosed ? "some rounds undisclosed" : null}
          />
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          {startup.website ? (
            <a className="link-block link-block--primary" href={startup.website} target="_blank" rel="noopener noreferrer">
              Website ↗
            </a>
          ) : null}
          {startup.sourceUrls?.map((url) => (
            <SourceLink key={url} url={url} />
          ))}
        </div>
      </header>

      {/* ---- Description --------------------------------------------------- */}
      {startup.description ? (
        <section className="border-b-[3px] py-8">
          <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {startup.description}
          </p>
        </section>
      ) : null}

      {/* ---- Founders ------------------------------------------------------ */}
      {startup.founders.length > 0 ? (
        <section className="border-b-[3px] py-8">
          <SectionHeading title="Founders" />
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {startup.founders.map((f) => (
              <li key={f.slug} className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{f.name}</span>
                {f.role ? (
                  <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                    {f.role}
                  </span>
                ) : null}
                {f.linkedin ? (
                  <a className="tag" href={f.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)" }}>
                    LinkedIn ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Funding ------------------------------------------------------- */}
      <section className="border-b-[3px] py-8" id="funding">
        <SectionHeading
          title="Funding"
          aside={startup.rounds.length > 0 ? `${startup.rounds.length} rounds` : null}
        />
        <RoundsTable
          rows={startup.rounds}
          emptyTitle="No rounds recorded"
          emptyDetail="Either this company hasn't raised, or we haven't sourced it yet."
        />
      </section>

      {/* ---- Innovations --------------------------------------------------- */}
      {startup.innovations.length > 0 ? (
        <section className="border-b-[3px] py-8">
          <SectionHeading title="Shipped" />
          <ul className="grid gap-4 md:grid-cols-2">
            {startup.innovations.map((i) => (
              <li key={i.id} className="block-card-sm p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="display text-lg">{i.title}</h3>
                  <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDbDate(i.launchDate) ?? ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="tag" style={{ color: "var(--text-muted)" }}>
                    {INNOVATION_LABELS[i.type]}
                  </span>
                  {i.githubUrl ? <SourceLink url={i.githubUrl} name="GitHub" /> : null}
                  {i.arxivUrl ? <SourceLink url={i.arxivUrl} name="arXiv" /> : null}
                  {i.huggingfaceUrl ? <SourceLink url={i.huggingfaceUrl} name="HF" /> : null}
                  {i.sourceUrl ? <SourceLink url={i.sourceUrl} /> : null}
                </div>
                {i.description ? (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {i.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Post-mortem --------------------------------------------------- */}
      {startup.shutdown ? (
        <section className="py-8">
          <SectionHeading
            title="Post-mortem"
            aside={formatDbDate(startup.shutdown.shutdownDate) ?? "Date unknown"}
            tone="vermillion"
          />
          <CauseTags causes={startup.shutdown.causeTags} />
          {startup.shutdown.lessons ? (
            <p className="mt-5 max-w-2xl text-sm leading-relaxed">
              {startup.shutdown.lessons}
            </p>
          ) : null}
          <div className="mt-5">
            <Link className="link-block" href={`/graveyard/${startup.slug}`}>
              Full post-mortem →
            </Link>
          </div>
        </section>
      ) : null}
    </article>
  );
}

/** One label/value pair in the identity block. Renders nothing when unknown. */
function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null | undefined;
  note?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="eyebrow mb-1.5">{label}</dt>
      <dd className="num text-sm font-semibold">{value}</dd>
      {note ? (
        <dd className="num mt-1 text-[0.625rem]" style={{ color: "var(--text-muted)" }}>
          {note}
        </dd>
      ) : null}
    </div>
  );
}
