import Link from "next/link";

import { CAUSE_LABELS, formatDbDate, usd } from "@/lib/format";
import type { ShutdownRow } from "@/lib/queries/graveyard";

/**
 * A shutdown, as a card.
 *
 * `cause_tags` is an array in the schema because companies rarely die of one
 * thing — the tags render as a set, in vermillion, which is the Graveyard's
 * section identity rather than a severity signal.
 */
export function GraveyardCard({ row }: { row: ShutdownRow }) {
  const raised = usd(row.totalRaisedUsd);

  return (
    <article className="block-card-sm p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="display text-xl">
          {row.startup ? (
            <Link href={`/graveyard/${row.startup.slug}`}>{row.startup.name}</Link>
          ) : (
            "—"
          )}
        </span>
        <span className="num text-xs" style={{ color: "var(--text-muted)" }}>
          {formatDbDate(row.shutdownDate) ?? "Date unknown"}
        </span>
      </div>

      {/* No figure means no figure. "$0 raised" would be a claim; silence isn't. */}
      {raised ? (
        <div className="num mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {raised} raised
        </div>
      ) : null}

      <CauseTags causes={row.causeTags} />
    </article>
  );
}

export function CauseTags({ causes }: { causes: readonly string[] }) {
  if (causes.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {causes.map((c) => (
        <span key={c} className="tag" style={{ color: "var(--color-vermillion)" }}>
          {CAUSE_LABELS[c as keyof typeof CAUSE_LABELS] ?? c}
        </span>
      ))}
    </div>
  );
}
