import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeName,
  parseAmount,
  slugify,
  stripHtml,
  toDateOnly,
  truncateWords,
} from "./normalize";

test("normalizeName collapses legal suffixes and punctuation", () => {
  assert.equal(normalizeName("Sarvam AI"), "sarvam ai");
  assert.equal(normalizeName("Sarvam AI Pvt. Ltd."), "sarvam ai");
  assert.equal(normalizeName("Observe.AI"), "observe ai");
  assert.equal(normalizeName("Krutrim SI Designs Private Limited"), "krutrim si designs");
  assert.equal(normalizeName("Neysa Networks Technologies"), "neysa networks");
});

test("normalizeName does NOT merge alias relationships", () => {
  // This is the documented phase-1 limitation: "Ola Krutrim" and "Krutrim"
  // are an alias pair, not a spelling variant, so they stay distinct and the
  // item goes to human review rather than being silently merged.
  assert.notEqual(normalizeName("Ola Krutrim"), normalizeName("Krutrim"));
});

test("slugify produces url-safe ids", () => {
  assert.equal(slugify("Observe.AI"), "observe-ai");
  assert.equal(slugify("  Sarvam AI  "), "sarvam-ai");
});

test("parseAmount reads USD magnitudes", () => {
  assert.deepEqual(parseAmount("Sarvam AI raises $41 million"), {
    usd: 41_000_000,
    inr: null,
  });
  assert.deepEqual(parseAmount("raises $1.2bn in Series D"), {
    usd: 1_200_000_000,
    inr: null,
  });
  assert.deepEqual(parseAmount("bags $500K seed"), { usd: 500_000, inr: null });
});

test("parseAmount reads INR magnitudes and never converts", () => {
  const crore = parseAmount("startup raises Rs 340 crore");
  assert.equal(crore.inr, 3_400_000_000);
  // The critical assertion: no exchange rate is ever applied.
  assert.equal(crore.usd, null);

  assert.equal(parseAmount("₹50 lakh angel round").inr, 5_000_000);
});

test("parseAmount drops unqualified figures rather than guessing", () => {
  // "$40" in a funding headline usually means millions — but "usually" is not
  // good enough to record as fact, so it goes to review instead.
  assert.deepEqual(parseAmount("raises $40 from investors"), {
    usd: null,
    inr: null,
  });
});

test("stripHtml removes markup and decodes entities", () => {
  assert.equal(
    stripHtml("<p>Sarvam &amp; Krutrim raised <b>$41M</b></p>"),
    "Sarvam & Krutrim raised $41M",
  );
  assert.equal(stripHtml("<script>evil()</script>text"), "text");
});

test("truncateWords cuts at a word boundary", () => {
  const text = "the quick brown fox jumps over the lazy dog";
  const out = truncateWords(text, 20);
  assert.ok(out.length <= 21, `expected <= 21 chars, got ${out.length}`);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("jumpsover"));
  // Under the cap, nothing is changed and no ellipsis is added.
  assert.equal(truncateWords("short", 20), "short");
});

test("toDateOnly is UTC, so IST evenings don't drift a day", () => {
  assert.equal(toDateOnly(new Date("2026-07-22T18:30:00Z")), "2026-07-22");
  assert.equal(toDateOnly(null), null);
  assert.equal(toDateOnly(new Date("nonsense")), null);
});
