import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * The masthead. Lives in the root layout so every route shares one edge and
 * one set of rules.
 *
 * Only the sections that actually exist are links. The rest are inert spans in
 * muted ink — a nav item that navigates nowhere is worse than one that plainly
 * isn't ready yet.
 *
 * `active` is passed down from the page rather than read from usePathname(),
 * which would make the whole masthead a Client Component to render one border.
 */
export function SiteHeader({ active }: { active?: "podcast" }) {
  return (
    <header className="border-b-[3px]">
      <div className="shell flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-xs"
            style={{ background: "var(--color-marigold)" }}
          />
          <span className="display text-2xl leading-none">{SITE.name}</span>
        </Link>

        <nav className="eyebrow flex flex-wrap items-center gap-5">
          <span style={{ color: "var(--text-muted)" }}>Startups</span>
          <span style={{ color: "var(--text-muted)" }}>Funding</span>
          <span style={{ color: "var(--color-vermillion)" }}>Graveyard</span>
          <span style={{ color: "var(--text-muted)" }}>Innovations</span>
          <Link
            href="/podcast"
            className="pb-0.5"
            style={
              active === "podcast"
                ? {
                    color: "var(--text-primary)",
                    borderBottom: "2px solid var(--color-marigold)",
                  }
                : { color: "var(--text-primary)" }
            }
            aria-current={active === "podcast" ? "page" : undefined}
          >
            Podcast
          </Link>
        </nav>
      </div>
    </header>
  );
}
