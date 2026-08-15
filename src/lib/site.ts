/**
 * Single source of truth for site identity.
 * Renaming the site is a one-line change here (or an env override).
 */
export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Startup Central",
  tagline: "India's startup ecosystem, tracked",
  description:
    "Who raised, who shipped, who shut down. A structured, filterable record of Indian startups — plus founder interviews.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
