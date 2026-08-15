import type { Metadata } from "next";
import { Familjen_Grotesk, JetBrains_Mono, Manrope } from "next/font/google";

import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/site";

/**
 * Type stack for Ink & Marigold.
 *
 * These are self-hosted at build time by next/font — no runtime request to a
 * font CDN, so there is no layout shift and no third-party dependency.
 *
 * Substitution note: the direction originally named Clash Display + Satoshi,
 * which are Fontshare-only and can't be pulled through next/font/google.
 * Familjen Grotesk was the listed display alternate; Manrope stands in for
 * Satoshi. To use the originals, drop the .woff2 files into src/app/fonts/
 * and swap these for next/font/local — the CSS variables below are the only
 * contract, so nothing else changes.
 */
const display = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          There is no global disclaimer banner here any more. It said
          "illustrative sample data · not live records", which was true while
          every page rendered hardcoded arrays — and became a lie the moment
          they started reading Postgres.

          What replaced it is finer-grained and more useful: per-row provenance
          (source link, `Unverified`, `Auto-extracted` — see
          src/components/provenance.tsx) and a single "Updated {date}" line in
          the footer. A claim about one row now travels with that row.

          The masthead is rendered by each section's layout.tsx rather than
          here, so a section can mark its own nav item active without turning
          the whole header into a Client Component for one border. The footer
          carries no active state, so it does live here.
        */}
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
