import Link from "next/link";

import { PAGE_SIZE, buildHref, type SearchParams } from "@/lib/params";

/**
 * Prev / next links plus a position readout.
 *
 * Links rather than buttons, for the same reason as the filter chips: no
 * client bundle, and the URL stays the whole truth. Only the two neighbours
 * are rendered — a numbered pager over an unknown number of ingested rows is
 * a lot of chrome for a list nobody pages deeply into.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pathname,
  current,
}: {
  page: number;
  pageCount: number;
  total: number;
  pathname: string;
  current: SearchParams;
}) {
  if (total === 0) return null;

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-[3px] pt-4"
      aria-label="Pagination"
    >
      <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
        {from}—{to} of {total}
      </span>

      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link
            className="link-block"
            href={buildHref(pathname, current, { page: page > 2 ? page - 1 : undefined })}
            rel="prev"
          >
            ← Prev
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            className="link-block"
            href={buildHref(pathname, current, { page: page + 1 })}
            rel="next"
          >
            Next →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
