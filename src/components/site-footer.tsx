import { SITE } from "@/lib/site";

/**
 * Deliberately reads nothing.
 *
 * This lives in the root layout, so any query in here runs on *every* route —
 * including `/_not-found` and any other page that touches no data at all. An
 * earlier version put a "Last updated {date}" line here and turned a database
 * outage into a build failure on a 404 page. The homepage already shows that
 * date, in the one place it means something.
 */
export function SiteFooter() {
  return (
    <footer className="border-t-[3px] py-7">
      <div className="shell flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">
          {SITE.name} · {SITE.tagline}
        </span>
        <span className="eyebrow" style={{ color: "var(--text-muted)" }}>
          Facts + attribution, never republished prose
        </span>
      </div>
    </footer>
  );
}
