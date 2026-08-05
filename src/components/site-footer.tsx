import { SITE } from "@/lib/site";

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
