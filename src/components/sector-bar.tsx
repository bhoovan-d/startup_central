import { chartVar } from "@/lib/chart-palette";
import type { SectorSlice } from "@/lib/queries/stats";

import { EmptyState } from "./empty-state";

/**
 * Companies by sector, as one stacked bar.
 *
 * Two rules from `src/lib/chart-palette.ts` are load-bearing here and must
 * survive any edit:
 *
 *  - The 2px surface gap between fills is mandatory secondary encoding, not
 *    decoration. Dark emerald and vermillion sit at tritan ΔE 6.0, so the gap
 *    is what separates them for a viewer who can't separate the hues.
 *  - Colour comes from `slice.colorSlot` — the sector's own slot — never from
 *    the array index. Filtering the list must not repaint the survivors.
 *
 * Sectors with zero companies are dropped from the bar (a zero-width fill is
 * invisible anyway) but kept in the legend, so the taxonomy stays visible
 * while the data is still thin.
 */
export function SectorBar({ slices }: { slices: SectorSlice[] }) {
  const total = slices.reduce((n, s) => n + s.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No companies tagged yet"
        detail="The eight sectors below are seeded and ready; the bar fills in as companies are added."
      >
        <SectorLegend slices={slices} showCounts={false} />
      </EmptyState>
    );
  }

  const filled = slices.filter((s) => s.count > 0);

  return (
    <>
      <div className="mb-5 flex h-11 w-full">
        {filled.map((s, i) => (
          <div
            key={s.slug}
            className="h-full"
            style={{
              background: s.colorSlot === null ? "var(--text-muted)" : chartVar(s.colorSlot),
              flex: s.count,
              marginRight: i < filled.length - 1 ? 2 : 0,
            }}
            title={`${s.label} — ${s.count}`}
          />
        ))}
      </div>
      <SectorLegend slices={slices} showCounts />
    </>
  );
}

/** Identity is never colour-alone: every slice is named in the legend. */
function SectorLegend({
  slices,
  showCounts,
}: {
  slices: SectorSlice[];
  showCounts: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
      {slices.map((s) => (
        <li key={s.slug} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-xs"
            style={{
              background: s.colorSlot === null ? "var(--text-muted)" : chartVar(s.colorSlot),
            }}
          />
          <span className="num text-xs">{s.label}</span>
          {showCounts ? (
            <span className="num text-[0.625rem]" style={{ color: "var(--text-muted)" }}>
              {s.count}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
