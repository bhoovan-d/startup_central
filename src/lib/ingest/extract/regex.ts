import { parseAmount, toDateOnly } from "../normalize";
import type { ExtractInput, Extractor } from "./index";

/**
 * The zero-key extractor, and the default.
 *
 * It runs with no credentials and no network calls, which is what makes the
 * whole pipeline work out of the box. It is also deliberately timid: its
 * confidence is capped below 1.0, so with the default 0.85 threshold a regex
 * hit only auto-publishes when nearly everything lined up. Anything less lands
 * in the review queue, which is the right place for a guess.
 */

/** Headline shapes that indicate a funding event. */
const FUNDING = /\b(raise[sd]?|raising|secures?|secured|bags?|bagged|closes?|closed|nets?|mops? up|funding|fundraise|round)\b/i;
const SHUTDOWN = /\b(shuts? down|shutting down|shutdown|winds? down|winding down|ceases? operations|closes? shop|files? for insolvency|bankrupt)\b/i;
const ACQUISITION = /\b(acquires?|acquired|acquisition|buys? out|takeover|merges? with)\b/i;
const LAUNCH = /\b(launch(?:es|ed)?|unveils?|unveiled|releases?|released|open[- ]sources?d?|introduces?)\b/i;

/**
 * "Sarvam AI raises $41M" -> "Sarvam AI".
 *
 * Anchored at the start of the headline and stops at the verb. Publications
 * lead with the company in a funding story almost without exception; when they
 * don't, this returns null and the item goes to review rather than guessing at
 * a noun phrase somewhere in the middle.
 */
const COMPANY = /^([A-Z][\w.&'’-]*(?:\s+(?:[A-Z][\w.&'’-]*|of|and|&)){0,3})\s+(?:raise[sd]?|raising|secures?|secured|bags?|bagged|closes?|closed|nets?|shuts?|winds?|acquires?|acquired|launch(?:es|ed)?|unveils?|releases?)/;

/** "led by Lightspeed", "from Peak XV and Accel". */
const INVESTORS = /\b(led by|backed by|from)\s+([A-Z][\w.&'’-]*(?:\s+[A-Z][\w.&'’-]*)*(?:(?:,|\s+and\s+|\s+&\s+)[A-Z][\w.&'’-]*(?:\s+[A-Z][\w.&'’-]*)*)*)/;

const ROUND_KEYWORDS: [RegExp, string][] = [
  [/\bpre[-\s]?seed\b/i, "pre_seed"],
  [/\bpre[-\s]?series\s*a\b/i, "pre_series_a"],
  [/\bseries\s*a\b/i, "series_a"],
  [/\bseries\s*b\b/i, "series_b"],
  [/\bseries\s*c\b/i, "series_c"],
  [/\bseries\s*d\b/i, "series_d"],
  [/\bseries\s*e\b/i, "series_e"],
  [/\bseries\s*[fghij]\b/i, "series_f_plus"],
  [/\bseed\b/i, "seed"],
  [/\bbridge\b/i, "bridge"],
  [/\b(debt|venture debt)\b/i, "debt"],
  [/\bgrant\b/i, "grant"],
];

function detectRound(text: string): string | null {
  for (const [re, value] of ROUND_KEYWORDS) {
    if (re.test(text)) return value;
  }
  return null;
}

function detectEventType(title: string): string {
  // Order matters: "shuts down after raising $20M" is a shutdown story, and
  // the funding verb in it is describing the past.
  if (SHUTDOWN.test(title)) return "shutdown";
  if (ACQUISITION.test(title)) return "acquisition";
  if (FUNDING.test(title)) return "funding";
  if (LAUNCH.test(title)) return "launch";
  return "other";
}

function detectInvestors(text: string): { name: string; isLead: boolean }[] {
  const m = text.match(INVESTORS);
  if (!m) return [];

  const isLead = /led by/i.test(m[1]!);
  return m[2]!
    .split(/,|\sand\s|\s&\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length <= 120)
    .slice(0, 12)
    .map((name, i) => ({ name, isLead: isLead && i === 0 }));
}

export function createRegexExtractor(): Extractor {
  return {
    name: "regex",
    async extract(input: ExtractInput) {
      // The headline carries the facts; the excerpt is used only to firm up
      // the round type and investors, never to pull a different company out.
      const title = input.title;
      const haystack = `${title} ${input.excerpt}`;

      const eventType = detectEventType(title);
      const companyName = title.match(COMPANY)?.[1]?.trim() ?? null;
      const amount = parseAmount(haystack);
      const roundType = detectRound(haystack);
      const investors = detectInvestors(haystack);

      // Confidence is additive and capped at 0.95. A regex never earns 1.0 —
      // that value is reserved for rows a human entered.
      let confidence = 0.4;
      if (companyName) confidence += 0.2;
      if (amount.usd !== null || amount.inr !== null) confidence += 0.2;
      if (roundType) confidence += 0.1;
      if (investors.some((i) => i.isLead)) confidence += 0.1;
      if (eventType !== "funding") confidence -= 0.2;

      return {
        eventType,
        companyName,
        roundType: eventType === "funding" ? (roundType ?? "undisclosed") : null,
        amountUsd: amount.usd,
        amountInr: amount.inr,
        announcedDate: toDateOnly(input.publishedAt),
        investors,
        confidence: Math.max(0, Math.min(0.95, confidence)),
      };
    },
  };
}
