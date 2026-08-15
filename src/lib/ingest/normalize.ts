/**
 * Text normalisation for entity matching.
 *
 * The whole ingestion pipeline hinges on answering "is this the same company
 * we already have?" — and the only mechanism available is the unique
 * `normalized_name` index on `startups` and `investors`.
 */

/**
 * Legal-form and boilerplate suffixes, stripped so "Sarvam AI Pvt Ltd" and
 * "Sarvam AI" collapse.
 *
 * Deliberately conservative. "Labs" and "Technologies" are on the edge —
 * dropping them merges "Neysa Networks" with "Neysa", which is usually right;
 * anything more aggressive starts merging genuinely different companies, and a
 * wrong merge is far more expensive to undo than a missed one. A missed match
 * just sends the item to the review queue, which is where uncertain things are
 * supposed to go.
 */
const SUFFIXES = [
  "pvt",
  "private",
  "ltd",
  "limited",
  "llp",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "technologies",
  "technology",
  "labs",
  "laboratories",
];

/**
 * "Krutrim SI Designs Pvt. Ltd." -> "krutrim si designs"
 *
 * Note what this does NOT do: it will not collapse "Krutrim" and "Ola
 * Krutrim", because that is an alias relationship rather than a spelling one.
 * The schema comment on `startups.normalized_name` promises that collapse; it
 * needs a `startup_aliases` table, which is a later migration. Until then such
 * items land in the review queue, which is the correct place for a judgement
 * call.
 */
export function normalizeName(input: string): string {
  let s = input
    .normalize("NFKD")
    // Strip combining marks left behind by NFKD.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // Punctuation that varies between publications: "Observe.AI" / "Observe AI".
    .replace(/[.,'’"&\-–—/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip suffixes repeatedly: "Foo Technologies Pvt Ltd" has three.
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of SUFFIXES) {
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }

  return s;
}

/** URL-safe identifier derived from a name. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Strips tags and collapses whitespace in an RSS `<description>`.
 *
 * Feed descriptions are HTML fragments. We only ever keep a short excerpt of
 * one for attribution — see `EXCERPT_MAX` in `./persist.ts` — so this is about
 * getting clean text to truncate, not about rendering anything.
 */
export function stripHtml(input: string): string {
  // Entities are decoded BEFORE tags are stripped, and the order is
  // load-bearing. Feed descriptions almost always arrive entity-escaped
  // (`&lt;p&gt;…`), so stripping first would leave literal "<p>" in the text
  // and put the publisher's markup into our stored excerpt.
  const decoded = decodeEntities(input);

  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    // Ampersand last: decoding it first would turn "&amp;lt;" into "<".
    .replace(/&amp;/g, "&");
}

/** Truncate at a word boundary, appending an ellipsis only if we cut. */
export function truncateWords(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * A date the `funding_rounds.announced_date` column will accept: "YYYY-MM-DD".
 *
 * Always UTC. Indian publications post late in the IST evening, which is the
 * same calendar day in IST and the previous one in UTC — going through local
 * time would silently shift those rounds by a day depending on where the
 * ingest runs. UTC everywhere means the answer doesn't depend on the host.
 */
export function toDateOnly(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Parses a feed's `pubDate`/`updated` field. Null when unparseable. */
export function parseFeedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

const CRORE = 10_000_000;
const LAKH = 100_000;

export type ParsedAmount = { usd: number | null; inr: number | null };

/**
 * Pulls a money figure out of a headline.
 *
 * Returns USD and INR *separately* and never converts between them. The schema
 * carries both columns for exactly this reason: applying an exchange rate
 * would turn "₹340 crore, as reported" into "$41M, as computed by us at a rate
 * we picked" — a different and weaker claim, and one nobody can check against
 * the source.
 */
export function parseAmount(text: string): ParsedAmount {
  const usdMatch = text.match(
    /(?:\$|USD\s?|US\$)\s?([\d,]+(?:\.\d+)?)\s*(bn|b\b|billion|mn|m\b|million|k\b)?/i,
  );
  const inrMatch = text.match(
    /(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d+)?)\s*(cr|crore|crores|lakh|lakhs|l\b)?/i,
  );

  return {
    usd: usdMatch ? scaleUsd(usdMatch[1]!, usdMatch[2]) : null,
    inr: inrMatch ? scaleInr(inrMatch[1]!, inrMatch[2]) : null,
  };
}

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function scaleUsd(raw: string, unit: string | undefined): number | null {
  const n = toNumber(raw);
  if (n === null) return null;

  const u = unit?.toLowerCase();
  if (u === "bn" || u === "b" || u === "billion") return Math.round(n * 1_000_000_000);
  if (u === "mn" || u === "m" || u === "million") return Math.round(n * 1_000_000);
  if (u === "k") return Math.round(n * 1_000);

  // A bare "$40" in a funding headline means $40 million far more often than
  // it means forty dollars — but "far more often" is not good enough to record
  // as fact, so an unqualified figure is dropped and the item goes to review.
  return null;
}

function scaleInr(raw: string, unit: string | undefined): number | null {
  const n = toNumber(raw);
  if (n === null) return null;

  const u = unit?.toLowerCase();
  if (u === "cr" || u === "crore" || u === "crores") return Math.round(n * CRORE);
  if (u === "lakh" || u === "lakhs" || u === "l") return Math.round(n * LAKH);

  return null;
}
