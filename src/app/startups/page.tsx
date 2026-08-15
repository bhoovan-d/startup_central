import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { Pagination } from "@/components/pagination";
import { TagPills, UnverifiedTag } from "@/components/provenance";
import { SectionHeading } from "@/components/section-heading";
import { STATUS_LABELS } from "@/lib/format";
import {
  parsePage,
  parseSlug,
  parseSort,
  parseStartupStatus,
  type SearchParams,
} from "@/lib/params";
import { listStartups } from "@/lib/queries/startups";
import { listTags } from "@/lib/queries/tags";

export const metadata: Metadata = {
  title: "Startups",
  description: "Every AI-first company we track, filterable by sector and status.",
};

/**
 * The company index.
 *
 * Reads `searchParams`, so this route is dynamic — correct and unavoidable for
 * a filterable list. The filters themselves are plain links (see
 * `FilterChips`), so there is no client JavaScript on this page at all.
 */
export default async function Page({ searchParams }: PageProps<"/startups">) {
  // `searchParams` is a Promise in Next 16 — synchronous access was removed.
  const sp = (await searchParams) as SearchParams;

  const filters = {
    sector: parseSlug(sp.sector),
    status: parseStartupStatus(sp.status),
    sort: parseSort(sp.sort),
    page: parsePage(sp.page),
  };

  const [{ rows, total, pageCount }, tags] = await Promise.all([
    listStartups(filters),
    listTags(),
  ]);

  return (
    <div className="shell py-12">
      <SectionHeading
        as="h1"
        title="Startups"
        aside={total === 1 ? "1 company" : `${total} companies`}
      />

      <div className="mb-8 flex flex-col gap-3 border-b-[3px] pb-6">
        <FilterChips
          label="Sector"
          param="sector"
          pathname="/startups"
          current={sp}
          active={filters.sector}
          options={tags.map((t) => ({
            value: t.slug,
            label: t.label,
            colorSlot: t.colorSlot,
          }))}
        />
        <FilterChips
          label="Status"
          param="status"
          pathname="/startups"
          current={sp}
          active={filters.status}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={
            filters.sector || filters.status
              ? "No companies match this filter"
              : "No companies recorded yet"
          }
          detail={
            filters.sector || filters.status
              ? "Try clearing a filter — the index is still filling up."
              : "Companies are added by a reviewer from the ingestion queue, each with a source. Nothing is listed here until it has one."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => (
            <li key={s.slug} className="block-card-sm min-w-0 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/startups/${s.slug}`} className="display text-xl">
                  {s.name}
                </Link>
                <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                  {STATUS_LABELS[s.status]}
                </span>
              </div>

              {s.tagline ? (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {s.tagline}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <TagPills tags={s.tags} />
                {s.hqCity ? (
                  <span className="tag" style={{ color: "var(--text-muted)" }}>
                    {s.hqCity}
                  </span>
                ) : null}
                <UnverifiedTag verified={s.verified} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        total={total}
        pathname="/startups"
        current={sp}
      />
    </div>
  );
}
