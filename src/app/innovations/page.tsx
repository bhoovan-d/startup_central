import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { Pagination } from "@/components/pagination";
import { SourceLink, TagPill } from "@/components/provenance";
import { SectionHeading } from "@/components/section-heading";
import { INNOVATION_LABELS, formatDbDate } from "@/lib/format";
import {
  parseInnovationType,
  parsePage,
  parseSlug,
  type SearchParams,
} from "@/lib/params";
import { listInnovations } from "@/lib/queries/innovations";
import { listTags } from "@/lib/queries/tags";

export const metadata: Metadata = {
  title: "Innovations",
  description: "Models, papers, datasets and products shipped by Indian startups.",
};

export default async function Page({ searchParams }: PageProps<"/innovations">) {
  const sp = (await searchParams) as SearchParams;

  const filters = {
    type: parseInnovationType(sp.type),
    sector: parseSlug(sp.sector),
    page: parsePage(sp.page),
  };

  const [{ rows, total, pageCount }, tags] = await Promise.all([
    listInnovations(filters),
    listTags(),
  ]);

  const filtered = Boolean(filters.type || filters.sector);

  return (
    <div className="shell py-12">
      <SectionHeading
        as="h1"
        title="Innovations"
        aside={total === 1 ? "1 entry" : `${total} entries`}
      />

      <p className="mb-6 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Who actually shipped something — models, papers, datasets, open source.
        Every entry links out to the artefact itself.
      </p>

      <div className="mb-8 flex flex-col gap-3 border-b-[3px] pb-6">
        <FilterChips
          label="Sector"
          param="sector"
          pathname="/innovations"
          current={sp}
          active={filters.sector}
          options={tags.map((t) => ({ value: t.slug, label: t.label, colorSlot: t.colorSlot }))}
        />
        <FilterChips
          label="Kind"
          param="type"
          pathname="/innovations"
          current={sp}
          active={filters.type}
          options={Object.entries(INNOVATION_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches this filter" : "No innovations recorded yet"}
          detail={
            filtered
              ? "Try clearing a filter."
              : "Entries here point at a model card, a paper or a repository — something you can open and check."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((i) => (
            <li key={i.id} className="block-card-sm min-w-0 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-lg">{i.title}</h2>
                <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatDbDate(i.launchDate) ?? ""}
                </span>
              </div>

              {i.startup ? (
                <div className="mt-2">
                  <Link href={`/startups/${i.startup.slug}`} className="text-sm font-semibold">
                    {i.startup.name}
                  </Link>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <TagPill label={INNOVATION_LABELS[i.type]} colorSlot={i.colorSlot} />
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
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        total={total}
        pathname="/innovations"
        current={sp}
      />
    </div>
  );
}
