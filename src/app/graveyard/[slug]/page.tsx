import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CauseTags } from "@/components/graveyard-card";
import { SectionHeading } from "@/components/section-heading";
import { SourceLink, TagPills } from "@/components/provenance";
import { formatDbDate, usd } from "@/lib/format";
import { getShutdownBySlug, getShutdownSlugs } from "@/lib/queries/graveyard";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getShutdownSlugs(100);
}

export async function generateMetadata({
  params,
}: PageProps<"/graveyard/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const row = await getShutdownBySlug(slug);
  if (!row?.startup) return { title: "Not found" };

  return {
    title: `${row.startup.name} — post-mortem`,
    description: row.startup.tagline ?? undefined,
  };
}

/**
 * One post-mortem.
 *
 * Keyed on the *startup's* slug rather than the shutdown's id, because
 * `shutdowns_startup_idx` is unique on `startup_id` — one company has at most
 * one of these, so the company is the URL.
 *
 * `story` and `lessons` are the only long-form prose on this site written by
 * us. That is deliberate and it is what the footer means by "facts +
 * attribution, never republished prose".
 */
export default async function Page({ params }: PageProps<"/graveyard/[slug]">) {
  const { slug } = await params;
  const row = await getShutdownBySlug(slug);

  if (!row) notFound();

  const raised = usd(row.totalRaisedUsd);

  return (
    <article className="shell py-12">
      <header className="border-b-[3px] pb-8">
        <TagPills tags={row.tags} />

        <h1 className="display mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
          {row.startup?.name ?? "Unknown company"}
        </h1>

        {row.startup?.tagline ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {row.startup.tagline}
          </p>
        ) : null}

        <div className="mt-6">
          <CauseTags causes={row.causeTags} />
        </div>

        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="eyebrow mb-1.5">Shut down</dt>
            <dd className="num text-sm font-semibold">
              {formatDbDate(row.shutdownDate) ?? "Date unknown"}
            </dd>
          </div>
          {raised ? (
            <div>
              <dt className="eyebrow mb-1.5">Total raised</dt>
              <dd className="num text-sm font-semibold">{raised}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <SourceLink url={row.sourceUrl} />
          {row.startup ? (
            <Link className="link-block" href={`/startups/${row.startup.slug}`}>
              Company record →
            </Link>
          ) : null}
        </div>
      </header>

      {row.story ? (
        <section className="border-b-[3px] py-8">
          <SectionHeading title="What happened" />
          <div className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {row.story.split("\n\n").map((para, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {row.lessons ? (
        <section className="py-8">
          {/* The transferable takeaway. This is the section's whole reason to
              exist — see the column comment in src/db/schema.ts. */}
          <SectionHeading title="The lesson" tone="vermillion" />
          <div className="max-w-2xl text-base leading-relaxed">
            {row.lessons.split("\n\n").map((para, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
