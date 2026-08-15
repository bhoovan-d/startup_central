/**
 * Every formatter the site renders through.
 *
 * Two rules run through this file:
 *
 * 1. Nothing here uses `toLocaleDateString` or `Intl`. Both are sensitive to
 *    the runtime's timezone and locale, so the server and the browser can
 *    disagree on the day and React reports a hydration mismatch. Dates are
 *    split and formatted by hand instead.
 * 2. Nothing here invents a number. A null amount renders as "Undisclosed",
 *    never as $0 or $NaN, and INR is never converted to USD — see `usd`/`inr`.
 */

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * "$41.0M". Whole USD in, compact out.
 *
 * Null is a real value here: `funding_rounds.amount_usd` is nullable because
 * plenty of rounds are announced without a figure. Callers must render the
 * `Undisclosed` string rather than coercing to zero.
 */
export function usd(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

/**
 * "₹340 Cr". Whole INR in.
 *
 * Indian sources report in crore and lakh, and we store what the source said.
 * There is deliberately no INR->USD helper anywhere in this codebase: applying
 * an exchange rate would turn a reported fact into an invented one, and the
 * rate on the announcement date is not something we know.
 */
export function inr(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n >= 100_000_000 ? 0 : 1)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${n}`;
}

/**
 * The amount cell, resolved once so every table agrees.
 * USD wins when both are present; INR-only rounds show the rupee figure.
 */
export function formatAmount(
  amountUsd: number | null | undefined,
  amountInr: number | null | undefined,
): string {
  return usd(amountUsd) ?? inr(amountInr) ?? "Undisclosed";
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

/**
 * "22 JUL 2026" from a Postgres `date` column.
 *
 * Drizzle returns `date` columns as plain "YYYY-MM-DD" strings, so a split is
 * all this needs. Use this for `announced_date`, `shutdown_date`, `launch_date`.
 */
export function formatDbDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  const m = MONTHS[Number(month) - 1];
  if (!year || !m || !day) return null;
  return `${day} ${m} ${year}`;
}

/**
 * "22 JUL 2026" from a Postgres `timestamptz` column.
 *
 * Drizzle returns those as a JS `Date`, not a string — passing one to
 * `formatDbDate` would blow up on `.split`. Read the UTC components rather
 * than the local ones so a server in IST and a browser in UTC agree.
 */
export function formatTimestamp(d: Date | null | undefined): string | null {
  if (!d) return null;
  return `${String(d.getUTCDate()).padStart(2, "0")} ${
    MONTHS[d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

/** The `dateTime` attribute for a `<time>` wrapping a timestamptz. */
export function isoDate(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

/** "2026" — for the "since {year}" note under the capital stat. */
export function yearOf(iso: string | null | undefined): string | null {
  return iso ? (iso.split("-")[0] ?? null) : null;
}

/* -------------------------------------------------------------------------- */
/* Podcast                                                                     */
/* -------------------------------------------------------------------------- */

export function youtubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** "48 MIN" — episode runtimes are never precise enough to warrant seconds. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return `${Math.round(seconds / 60)} MIN`;
}

/** "3h 12m", for the aggregate runtime stat. */
export function formatTotalRuntime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/* -------------------------------------------------------------------------- */
/* Enum labels                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The enums are snake_case in the database and Title Case on screen. These
 * maps are exhaustive `Record`s keyed by the enum union, so adding a value to
 * `src/db/schema.ts` without adding a label here is a type error rather than a
 * raw `series_f_plus` leaking into the UI.
 */

export const ROUND_LABELS = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  pre_series_a: "Pre-Series A",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  series_d: "Series D",
  series_e: "Series E",
  series_f_plus: "Series F+",
  bridge: "Bridge",
  debt: "Debt",
  grant: "Grant",
  undisclosed: "Undisclosed",
} as const;

export const STATUS_LABELS = {
  active: "Active",
  acquired: "Acquired",
  shutdown: "Shut down",
  dormant: "Dormant",
} as const;

export const CAUSE_LABELS = {
  capital_crunch: "Capital crunch",
  regulatory: "Regulatory",
  governance: "Governance",
  no_pmf: "No PMF",
  acquihire: "Acquihire",
  competition: "Competition",
  cofounder_conflict: "Co-founder conflict",
  pivot_failed: "Pivot failed",
  fraud: "Fraud",
  other: "Other",
} as const;

export const INNOVATION_LABELS = {
  model: "Model",
  product: "Product",
  research: "Research",
  open_source: "Open source",
  patent: "Patent",
  dataset: "Dataset",
} as const;

export const INVESTOR_LABELS = {
  vc: "VC",
  angel: "Angel",
  cvc: "CVC",
  accelerator: "Accelerator",
  family_office: "Family office",
  sovereign: "Sovereign",
  other: "Other",
} as const;
