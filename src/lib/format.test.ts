import assert from "node:assert/strict";
import { test } from "node:test";

import { formatAmount, formatDbDate, formatTimestamp, isoDate, usd } from "./format";

test("formatTimestamp survives a cache round trip", () => {
  // The regression this exists for: Drizzle returns timestamptz as a Date,
  // but `unstable_cache` serialises through JSON, so the identical query
  // returns an ISO string on a cache hit. Formatting only the Date shape
  // crashed the production homepage with "getUTCDate is not a function"
  // while dev — where the cache is usually cold — looked fine.
  const date = new Date("2026-07-22T18:30:00Z");
  const cached = JSON.parse(JSON.stringify({ at: date })).at as string;

  assert.equal(formatTimestamp(date), "22 JUL 2026");
  assert.equal(formatTimestamp(cached), "22 JUL 2026", "cache-hit shape must format identically");
  assert.equal(formatTimestamp(date), formatTimestamp(cached));
});

test("isoDate survives the same round trip", () => {
  const date = new Date("2026-07-22T18:30:00Z");
  const cached = JSON.parse(JSON.stringify({ at: date })).at as string;
  assert.equal(isoDate(date), "2026-07-22");
  assert.equal(isoDate(cached), "2026-07-22");
});

test("timestamp formatters degrade rather than throw", () => {
  for (const bad of [null, undefined, "", "not-a-date", Number.NaN]) {
    assert.equal(formatTimestamp(bad), null, `formatTimestamp(${String(bad)})`);
    assert.equal(isoDate(bad), undefined, `isoDate(${String(bad)})`);
  }
});

test("formatTimestamp reads UTC, not local time", () => {
  // 18:30Z is the next day in IST. The rendered day must not depend on where
  // the server happens to run, or server and browser disagree and React
  // reports a hydration mismatch.
  assert.equal(formatTimestamp("2026-07-22T18:30:00Z"), "22 JUL 2026");
  assert.equal(formatTimestamp("2026-07-22T23:59:59Z"), "22 JUL 2026");
});

test("formatDbDate handles plain date columns", () => {
  assert.equal(formatDbDate("2026-08-13"), "13 AUG 2026");
  assert.equal(formatDbDate(null), null);
});

test("amounts never render a fabricated zero", () => {
  assert.equal(formatAmount(null, null), "Undisclosed");
  assert.equal(formatAmount(93_000_000, null), "$93.0M");
  // INR-only rounds show rupees rather than a converted dollar figure.
  // Larger crore figures drop the decimal; smaller ones keep it.
  assert.equal(formatAmount(null, 270_000_000), "₹27 Cr");
  assert.equal(formatAmount(null, 85_000_000), "₹8.5 Cr");
  assert.equal(usd(null), null);
});
