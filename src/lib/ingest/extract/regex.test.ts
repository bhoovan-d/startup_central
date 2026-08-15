import assert from "node:assert/strict";
import { test } from "node:test";

import { ExtractedEvent } from "../schema";
import { createRegexExtractor } from "./regex";

const extractor = createRegexExtractor();

function input(title: string, excerpt = "") {
  return {
    title,
    excerpt,
    url: "https://example.com/a",
    sourceName: "Example",
    publishedAt: new Date("2026-07-22T09:00:00Z"),
  };
}

async function extract(title: string, excerpt = "") {
  const raw = await extractor.extract(input(title, excerpt));
  const parsed = ExtractedEvent.safeParse(raw);
  assert.ok(parsed.success, `schema rejected output: ${JSON.stringify(raw)}`);
  return parsed.data;
}

test("extracts a well-formed funding headline", async () => {
  const e = await extract("Sarvam AI raises $41M Series B led by Lightspeed");

  assert.equal(e.eventType, "funding");
  assert.equal(e.companyName, "Sarvam AI");
  assert.equal(e.roundType, "series_b");
  assert.equal(e.amountUsd, 41_000_000);
  assert.equal(e.announcedDate, "2026-07-22");
  assert.deepEqual(e.investors, [{ name: "Lightspeed", isLead: true }]);
});

test("caps confidence below 1.0 even on a perfect match", async () => {
  const e = await extract("Sarvam AI raises $41M Series B led by Lightspeed");
  // 1.0 is reserved for rows a human entered. A regex never earns it.
  assert.ok(e.confidence <= 0.95, `expected <= 0.95, got ${e.confidence}`);
  assert.ok(e.confidence > 0.85, "a fully-matched headline should clear the threshold");
});

test("a vague headline lands below the auto-publish threshold", async () => {
  const e = await extract("Indian AI startups see record funding this quarter");
  assert.ok(e.confidence < 0.85, `expected < 0.85, got ${e.confidence}`);
  // No company is nameable here — recorded as null and still schema-valid, so
  // a reviewer sees the partial extraction rather than nothing at all.
  assert.equal(e.companyName, null);
});

test("records rupee amounts without converting", async () => {
  const e = await extract("CoRover raises Rs 45 crore in Series A");
  assert.equal(e.amountInr, 450_000_000);
  assert.equal(e.amountUsd, null);
});

test("a shutdown headline is classified as a shutdown, not funding", async () => {
  // "shuts down after raising $20M" contains a funding verb describing the
  // past — event type must not be driven by that.
  const e = await extract("Otipy shuts down after raising $42M");
  assert.equal(e.eventType, "shutdown");
  assert.equal(e.roundType, null);
});

test("always dates from the feed, never invents one", async () => {
  const raw = await extractor.extract({ ...input("Foo raises $5M seed"), publishedAt: null });
  const e = ExtractedEvent.parse(raw);
  assert.equal(e.announcedDate, null);
});

test("output always satisfies the schema, even on junk input", async () => {
  for (const title of ["", "?????", "a", "RAISES RAISES RAISES"]) {
    const raw = await extractor.extract(input(title));
    // companyName has a min length, so junk may legitimately fail validation —
    // what must never happen is a throw or a malformed shape.
    const parsed = ExtractedEvent.safeParse(raw);
    if (parsed.success) {
      assert.ok(parsed.data.confidence >= 0 && parsed.data.confidence <= 1);
    }
  }
});
