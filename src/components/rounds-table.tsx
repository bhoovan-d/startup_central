import Link from "next/link";

import { chartVar } from "@/lib/chart-palette";
import { ROUND_LABELS, formatAmount, formatDbDate } from "@/lib/format";
import type { RoundRow } from "@/lib/queries/funding";

import { EmptyState } from "./empty-state";
import { SourceLink } from "./provenance";

/**
 * The dense mono funding table.
 *
 * Two things it will not do: render `$NaN`, and render `$0`. A round with no
 * disclosed figure says "Undisclosed" — plenty of rounds are announced without
 * one, and a zero would be a claim we can't support.
 */
export function RoundsTable({
  rows,
  showSource = true,
  emptyTitle = "No rounds recorded yet",
  emptyDetail,
}: {
  rows: RoundRow[];
  showSource?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        detail={
          emptyDetail ??
          "Rounds appear here once the ingestion pipeline has run and a reviewer has confirmed them."
        }
      />
    );
  }

  return (
    <div className="block-card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Round</th>
            <th className="text-right">Amount</th>
            <th>Lead</th>
            <th className="text-right">Date</th>
            {showSource ? <th className="text-right">Source</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap font-semibold">
                <span
                  aria-hidden
                  className="mr-2 inline-block h-2 w-2 align-middle"
                  style={{
                    background:
                      r.colorSlot === null
                        ? "var(--text-muted)"
                        : chartVar(r.colorSlot),
                  }}
                />
                {r.startup ? (
                  <Link href={`/startups/${r.startup.slug}`}>{r.startup.name}</Link>
                ) : (
                  "—"
                )}
              </td>
              <td style={{ color: "var(--text-secondary)" }}>
                {ROUND_LABELS[r.roundType]}
              </td>
              <td className="num text-right font-semibold">
                {formatAmount(r.amountUsd, r.amountInr)}
              </td>
              <td style={{ color: "var(--text-secondary)" }}>
                {r.leadInvestor ?? "—"}
              </td>
              <td className="num text-right" style={{ color: "var(--text-muted)" }}>
                {formatDbDate(r.announcedDate) ?? "—"}
              </td>
              {showSource ? (
                <td className="text-right">
                  <SourceLink url={r.sourceUrl} name={r.sourceName} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
