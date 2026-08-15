import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { runIngest } from "@/lib/ingest";
import { IngestRequest } from "@/lib/ingest/schema";
import { CACHE_TAGS } from "@/lib/queries/_cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Triggers an ingest run. Called by the GitHub Actions cron.
 *
 * Everything it does lives in `runIngest`, so this handler is only auth,
 * validation, and cache invalidation — and the CLI can do the same work with
 * no HTTP involved.
 */
export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;

  // No secret configured means the endpoint is off, not open. Returning 503
  // rather than running is the difference between "not set up yet" and "a
  // public write endpoint on the internet".
  if (!secret) {
    return Response.json({ error: "ingest disabled" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !secretMatches(header.slice(7), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = IngestRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid request", detail: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.revalidateOnly) {
    // Immediate expiry, not stale-while-revalidate: this path is a person who
    // just approved a round asking to see it. `"max"` would serve them one
    // more stale page, which reads as the approval having failed.
    dropCaches({ expire: 0 });
    return Response.json({ ok: true, revalidated: true });
  }

  const report = await runIngest(parsed.data);

  if (!report.dryRun && (report.autoPublished > 0 || report.newItems > 0)) {
    // The cron has nobody waiting, so prefer stale-while-revalidate: readers
    // get an instant page and the refresh happens behind it.
    dropCaches("max");
  }

  return Response.json(report);
}

/**
 * Drops every cache tag a write can affect.
 *
 * The second argument is required in Next 16 — a bare `revalidateTag(tag)` is
 * a type error. It also decides the semantics: `"max"` marks the tag stale and
 * serves the existing page while refreshing behind it, whereas `{ expire: 0 }`
 * expires the entry so the very next request rebuilds it.
 */
function dropCaches(profile: string | { expire: number }): void {
  for (const tag of [
    CACHE_TAGS.rounds,
    CACHE_TAGS.stats,
    CACHE_TAGS.startups,
    CACHE_TAGS.shutdowns,
    CACHE_TAGS.innovations,
  ]) {
    revalidateTag(tag, profile);
  }
}

/**
 * Constant-time comparison of the bearer token.
 *
 * Both sides are hashed first so the buffers are always 32 bytes:
 * `timingSafeEqual` throws on unequal lengths, and that throw would itself
 * leak the secret's length.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
