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
 * The verb that separates the subject of a headline from what happened to it.
 *
 * Case-insensitive, which is the whole point: Indian tech publications write
 * headlines in Title Case ("Rapido Bags…", "Zetwerk Raises…"). An earlier
 * version folded this into a single case-sensitive pattern, so the verb never
 * matched a real headline, no company was ever extracted, and nothing could
 * be published — the pipeline collected articles forever and produced nothing.
 */
const EVENT_VERB =
  /\b(raises?|raised|raising|secures?|secured|bags?|bagged|closes?|closed|nets?|netted|mops? up|shuts? down|winds? down|acquires?|acquired|launch(?:es|ed)?|unveils?|unveiled|releases?|released)\b/i;

/**
 * Words that are capitalised in a headline but name no company. Without this,
 * roundups like "…Indian Startups Raised $140 Mn This Week" yield "Indian
 * Startups" as the company and score it as a real extraction.
 */
const NOT_A_COMPANY = new Set([
  "startup", "startups", "company", "companies", "firm", "firms",
  "unicorn", "unicorns", "founder", "founders", "investor", "investors",
  "govt", "government", "report", "india", "indian", "week", "month",
  "fund", "funds", "vc", "vcs", "who", "what", "this", "these",
]);

/**
 * "Sarvam AI raises $41M" -> "Sarvam AI"; "Rapido Bags…" -> "Rapido".
 *
 * Finds the event verb, then walks backwards over the capitalised words in
 * front of it. Publications lead with the company in a funding story almost
 * without exception; when the words before the verb aren't a name, this
 * returns null and the item goes to review rather than guessing at a noun
 * phrase somewhere in the middle.
 */
function detectCompany(title: string): string | null {
  const verb = title.match(EVENT_VERB);
  if (!verb || verb.index === undefined) return null;

  const before = title.slice(0, verb.index).trim();
  if (!before) return null;

  const tokens = before.split(/\s+/);
  const name: string[] = [];

  for (let i = tokens.length - 1; i >= 0 && name.length < 4; i--) {
    const token = tokens[i]!;
    const isCapitalised = /^[A-Z][\w.&'’-]*$/.test(token);
    // Joiners only count when they sit between two capitalised words, so
    // "Bank of Baroda" holds together but a leading "And" does not.
    const isJoiner = name.length > 0 && /^(of|and|&|the)$/i.test(token);
    if (!isCapitalised && !isJoiner) break;
    name.unshift(token);
  }

  while (name.length > 0 && /^(of|and|&|the)$/i.test(name[0]!)) name.shift();
  if (name.length === 0) return null;

  // A name made only of generic nouns is not a name.
  if (name.every((t) => NOT_A_COMPANY.has(t.toLowerCase().replace(/[^\w]/g, "")))) {
    return null;
  }

  return name.join(" ");
}

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

/**
 * A VC firm closing a fund is not a startup raising a round.
 *
 * "Accel raises $550 Mn India fund" and "Bluehill.VC closes maiden fund" both
 * parse as funding events with a company and an amount, and would publish as
 * startup rounds — a whole class of wrong rows. The subject being a fund
 * vehicle is the tell, so these route to review as `other` instead.
 */
const FUND_VEHICLE_SUBJECT = /\b(capital|ventures?|partners|vc|amc|asset management|advisors)\b/i;

function looksLikeFundVehicle(title: string, company: string | null): boolean {
  if (company && FUND_VEHICLE_SUBJECT.test(company)) return true;
  // "closes maiden frontier-tech fund at Rs 400 Cr", "raises $550 Mn India fund"
  return /\b(closes?|closed|raises?|raised)\b[^.]{0,40}\b(fund|corpus)\b/i.test(title);
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

      const companyName = detectCompany(title);
      const eventType = looksLikeFundVehicle(title, companyName)
        ? "other"
        : detectEventType(title);
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
