import type { Metadata } from "next";

import { FilterChips } from "@/components/filter-chips";
import { Pagination } from "@/components/pagination";
import { RoundsTable } from "@/components/rounds-table";
import { SectionHeading } from "@/components/section-heading";
import { ROUND_LABELS } from "@/lib/format";
import {
  parseDate,
  parsePage,
  parseRoundType,
  parseSlug,
  type SearchParams,
} from "@/lib/params";
import { listRounds } from "@/lib/queries/funding";
import { listTags } from "@/lib/queries/tags";

export const metadata: Metadata = {
  title: "Funding",
  description: "Every disclosed round, with the source it came from.",
};

/**
 * The funding ledger.
 *
 * There is deliberately no `/funding/[id]` detail route. A round is a row, not
 * an entity worth a page: per-round pages would mint hundreds of thin,
 * near-empty documents keyed on a serial id. The company name links to
 * `/startups/[slug]#funding` and the source column links out to the article.
 */
export default async function Page({ searchParams }: PageProps<"/funding">) {
  const sp = (await searchParams) as SearchParams;

  const filters = {
    round: parseRoundType(sp.round),
    sector: parseSlug(sp.sector),
    from: parseDate(sp.from),
    to: parseDate(sp.to),
    page: parsePage(sp.page),
  };

  const [{ rows, total, pageCount }, tags] = await Promise.all([
    listRounds(filters),
    listTags(),
  ]);

  const filtered = Boolean(filters.round || filters.sector || filters.from || filters.to);

  return (
    <div className="shell py-12">
      <SectionHeading
        as="h1"
        title="Funding"
        aside={total === 1 ? "1 round" : `${total} rounds`}
      />

      <div className="mb-8 flex flex-col gap-3 border-b-[3px] pb-6">
        <FilterChips
          label="Sector"
          param="sector"
          pathname="/funding"
          current={sp}
          active={filters.sector}
          options={tags.map((t) => ({ value: t.slug, label: t.label, colorSlot: t.colorSlot }))}
        />
        <FilterChips
          label="Stage"
          param="round"
          pathname="/funding"
          current={sp}
          active={filters.round}
          options={Object.entries(ROUND_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <RoundsTable
        rows={rows}
        emptyTitle={filtered ? "No rounds match this filter" : "No rounds recorded yet"}
        emptyDetail={
          filtered
            ? "Try clearing a filter — the ledger is still filling up."
            : "Rounds arrive through the ingestion pipeline, each carrying the article it was extracted from. Nothing is listed without one."
        }
      />

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        total={total}
        pathname="/funding"
        current={sp}
      />
    </div>
  );
}
