import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { GraveyardCard } from "@/components/graveyard-card";
import { Pagination } from "@/components/pagination";
import { SectionHeading } from "@/components/section-heading";
import { CAUSE_LABELS } from "@/lib/format";
import {
  parsePage,
  parseShutdownCause,
  parseYear,
  type SearchParams,
} from "@/lib/params";
import { listShutdowns } from "@/lib/queries/graveyard";

export const metadata: Metadata = {
  title: "Graveyard",
  description:
    "Companies that shut down, why they did, and what the next founder should take from it.",
};

export default async function Page({ searchParams }: PageProps<"/graveyard">) {
  const sp = (await searchParams) as SearchParams;

  const filters = {
    cause: parseShutdownCause(sp.cause),
    year: parseYear(sp.year),
    page: parsePage(sp.page),
  };

  const { rows, total, pageCount } = await listShutdowns(filters);
  const filtered = Boolean(filters.cause || filters.year);

  return (
    <div className="shell py-12">
      <SectionHeading
        as="h1"
        title="Graveyard"
        aside={total === 1 ? "1 company" : `${total} companies`}
        tone="vermillion"
      />

      <p className="mb-6 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Post-mortems are written by hand, never extracted. A cause of death and
        the lesson under it are judgements, and no parser gets to make them.
      </p>

      <div className="mb-8 border-b-[3px] pb-6">
        <FilterChips
          label="Cause"
          param="cause"
          pathname="/graveyard"
          current={sp}
          active={filters.cause}
          options={Object.entries(CAUSE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No shutdowns match this filter" : "No shutdowns recorded yet"}
          detail={
            filtered
              ? "Try clearing the filter."
              : "A company only appears here once someone has written up what happened and why."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <GraveyardCard row={r} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        total={total}
        pathname="/graveyard"
        current={sp}
      />
    </div>
  );
}
