import Link from "next/link";

import { chartVar } from "@/lib/chart-palette";
import { buildHref, type SearchParams } from "@/lib/params";

export type ChipOption = {
  value: string;
  label: string;
  /** Sector chips carry their own palette slot; other filters leave it null. */
  colorSlot?: number | null;
};

/**
 * A row of filter chips.
 *
 * These are `<Link>`s that rewrite the query string, not buttons with state.
 * That is what keeps every list page a Server Component: there is no client
 * bundle, the filters survive with JavaScript disabled, and the URL is always
 * the whole truth about what is being shown. `buildHref` resets `page` on
 * every change, so switching a filter can't strand you on page 7 of 2.
 *
 * The active chip is a link back to the unfiltered list, so clicking it twice
 * clears it — the behaviour a toggle would have.
 */
export function FilterChips({
  label,
  param,
  options,
  active,
  pathname,
  current,
}: {
  label: string;
  param: string;
  options: ChipOption[];
  active: string | undefined;
  pathname: string;
  current: SearchParams;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="eyebrow" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>

      <Link
        href={buildHref(pathname, current, { [param]: undefined })}
        className="tag"
        style={
          active === undefined
            ? { color: "var(--text-primary)", borderColor: "var(--color-marigold)" }
            : { color: "var(--text-muted)" }
        }
        aria-current={active === undefined ? "true" : undefined}
      >
        All
      </Link>

      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <Link
            key={o.value}
            href={buildHref(pathname, current, {
              [param]: isActive ? undefined : o.value,
            })}
            className="tag"
            style={{
              color:
                o.colorSlot === null || o.colorSlot === undefined
                  ? isActive
                    ? "var(--text-primary)"
                    : "var(--text-muted)"
                  : chartVar(o.colorSlot),
              borderColor: isActive ? "var(--color-marigold)" : undefined,
            }}
            aria-current={isActive ? "true" : undefined}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
