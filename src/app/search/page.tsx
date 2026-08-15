import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { UnverifiedTag } from "@/components/provenance";
import { SearchForm } from "@/components/search-form";
import { SectionHeading } from "@/components/section-heading";
import { STATUS_LABELS } from "@/lib/format";
import { parsePage, parseQuery, type SearchParams } from "@/lib/params";
import { searchStartups } from "@/lib/queries/search";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

/**
 * Full-text search over companies.
 *
 * Backed by the generated `search_vector` column and its GIN index — see the
 * note at the top of `src/db/schema.ts` for why there is no external search
 * service here.
 */
export default async function Page({ searchParams }: PageProps<"/search">) {
  const sp = (await searchParams) as SearchParams;
  const q = parseQuery(sp.q);
  const page = parsePage(sp.page);

  const result = q ? await searchStartups(q, page) : null;

  return (
    <div className="shell py-12">
      <SectionHeading
        as="h1"
        title="Search"
        aside={result ? (result.total === 1 ? "1 result" : `${result.total} results`) : null}
      />

      <div className="mb-8 border-b-[3px] pb-6">
        <SearchForm defaultValue={q} />
      </div>

      {!q ? (
        <EmptyState
          title="Type a company name"
          detail="Searches company names, taglines and descriptions."
        />
      ) : result && result.rows.length === 0 ? (
        <EmptyState
          title={`Nothing found for “${q}”`}
          detail="The index only contains companies that have been sourced and reviewed — a miss here doesn't mean the company doesn't exist."
        />
      ) : (
        <>
          {result?.fallback ? (
            <p className="eyebrow mb-4" style={{ color: "var(--text-muted)" }}>
              Prefix match
            </p>
          ) : null}

          <ul className="flex flex-col gap-3">
            {result?.rows.map((hit) => (
              <li key={hit.slug} className="block-card-sm p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/startups/${hit.slug}`} className="display text-xl">
                    {hit.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <UnverifiedTag verified={hit.verified} />
                    <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
                      {STATUS_LABELS[hit.status as keyof typeof STATUS_LABELS] ?? hit.status}
                    </span>
                  </div>
                </div>
                {hit.tagline ? (
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {hit.tagline}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {result ? (
            <Pagination
              page={page}
              pageCount={result.pageCount}
              total={result.total}
              pathname="/search"
              current={sp}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
