export type Source = {
  key: string;
  /** Stored on every row as `source_name`, so it appears in attribution. */
  name: string;
  feedUrl: string;
  /**
   * When set, only items whose title matches are considered. Used for general
   * technology feeds where most items are out of scope, so we never fetch or
   * store what we won't use.
   */
  titleFilter?: RegExp;
  enabled: boolean;
};

/**
 * The feeds we read.
 *
 * Only publishers' own RSS endpoints — never an article page, never a scraper.
 * We take the headline, the link, the date and a short excerpt for
 * attribution; the extracted facts (company, amount, round, investors) are not
 * copyrightable, the prose is, and we don't store it.
 *
 * Feed URLs rot and publishers reorganise. `runIngest` catches per-source, so
 * a dead feed shows up as one line in the report's `errors` rather than taking
 * the run down. Verify these when adding a source — an HTML 404 page parses to
 * zero items and looks identical to a quiet news day.
 */
export const SOURCES: Source[] = [
  {
    key: "inc42",
    name: "Inc42",
    feedUrl: "https://inc42.com/feed/",
    enabled: true,
  },
  {
    key: "entrackr",
    name: "Entrackr",
    // `/rss`, not the WordPress-conventional `/feed/` — that path 404s here.
    feedUrl: "https://entrackr.com/rss",
    enabled: true,
  },
  {
    key: "yourstory",
    name: "YourStory",
    feedUrl: "https://yourstory.com/feed",
    enabled: true,
  },
  {
    key: "moneycontrol-tech",
    name: "Moneycontrol",
    feedUrl: "https://www.moneycontrol.com/rss/technology.xml",
    // Disabled: the CDN returns 403 "Access Denied" to this crawler on every
    // feed path, which is a deliberate block rather than a wrong URL. Leaving
    // it enabled would put a guaranteed error line in every scheduled run and
    // train us to ignore the report. Re-enable only if we get access.
    enabled: false,
  },
  {
    key: "techcrunch",
    name: "TechCrunch",
    feedUrl: "https://techcrunch.com/feed/",
    // A global feed: only India/AI-shaped headlines are worth extracting.
    titleFilter: /\b(india|indian|bengaluru|bangalore|mumbai|delhi|hyderabad)\b/i,
    enabled: true,
  },
];

export function resolveSources(keys?: string[]): Source[] {
  const enabled = SOURCES.filter((s) => s.enabled);
  if (!keys || keys.length === 0) return enabled;

  const wanted = new Set(keys);
  return enabled.filter((s) => wanted.has(s.key));
}
