import Link from "next/link";

import { SearchForm } from "@/components/search-form";
import { SITE } from "@/lib/site";

export type Section =
  | "startups"
  | "funding"
  | "graveyard"
  | "innovations"
  | "podcast";

/**
 * The masthead.
 *
 * Every section is a real link now. They used to be inert spans in muted ink,
 * which was the honest rendering while those routes did not exist — a nav item
 * that navigates nowhere is worse than one that plainly isn't ready yet.
 *
 * `active` is passed down from the section's `layout.tsx` rather than read
 * from `usePathname()`, which would make the whole masthead a Client Component
 * in order to render one border. Detail routes inherit their section's layout,
 * so `/startups/sarvam-ai` lights the Startups item for free.
 */

const NAV: { section: Section; href: string; label: string; tone?: string }[] = [
  { section: "startups", href: "/startups", label: "Startups" },
  { section: "funding", href: "/funding", label: "Funding" },
  {
    section: "graveyard",
    href: "/graveyard",
    label: "Graveyard",
    // Vermillion is the Graveyard's section identity, not a status signal.
    tone: "var(--color-vermillion)",
  },
  { section: "innovations", href: "/innovations", label: "Innovations" },
  { section: "podcast", href: "/podcast", label: "Podcast" },
];

export function SiteHeader({ active }: { active?: Section }) {
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

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <nav className="eyebrow flex flex-wrap items-center gap-5">
            {NAV.map((item) => {
              const isActive = active === item.section;
              return (
                <Link
                  key={item.section}
                  href={item.href}
                  className="pb-0.5"
                  style={{
                    color: item.tone ?? "var(--text-primary)",
                    borderBottom: isActive
                      ? "2px solid var(--color-marigold)"
                      : undefined,
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <SearchForm />
        </div>
      </div>
    </header>
  );
}
