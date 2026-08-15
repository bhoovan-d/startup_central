/**
 * Runs the ingest pipeline locally.
 *
 *   npm run ingest -- --dry-run          fetch + extract, write nothing
 *   npm run ingest -- --limit 10
 *   npm run ingest -- --source inc42
 *
 * Same code path as POST /api/ingest, minus the HTTP and the bearer token.
 * `--dry-run` is the one to reach for when adding or verifying a feed.
 */

// tsx doesn't load .env, and this file talks to Postgres. See src/db/seed.ts.
import "dotenv/config";

import { closeDb } from "@/db";
import { runIngest } from "@/lib/ingest";
import { SOURCES } from "@/lib/ingest/sources";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  if (has("list-sources")) {
    for (const s of SOURCES) {
      console.log(`${s.enabled ? " " : "-"} ${s.key.padEnd(20)} ${s.feedUrl}`);
    }
    return;
  }

  const dryRun = has("dry-run");
  const limitArg = flag("limit");
  const source = flag("source");

  console.log(
    `Ingest: ${dryRun ? "DRY RUN (no writes)" : "live"}${source ? `, source=${source}` : ""}`,
  );

  const report = await runIngest({
    dryRun,
    revalidateOnly: false,
    limit: limitArg ? Number(limitArg) : 40,
    sources: source ? [source] : undefined,
    since: flag("since"),
  });

  console.log("");
  console.log(`  feed items fetched   ${report.fetched}`);
  console.log(`  considered           ${report.parsed}`);
  console.log(`  new articles         ${report.newItems}`);
  console.log(`  extracted            ${report.extracted}`);
  console.log(`  auto-published       ${report.autoPublished}`);
  console.log(`  queued for review    ${report.pending}`);
  console.log(`  out of scope         ${report.rejected}`);
  console.log(`  skipped (seen)       ${report.skipped}`);
  console.log(`  took                 ${report.durationMs}ms`);

  if (report.errors.length > 0) {
    console.log("\n  errors:");
    for (const e of report.errors) console.log(`    ${e}`);
  }

  if (report.pending > 0) {
    console.log("\nRun `npm run ingest:review` to work the queue.");
  }
}

// Set `exitCode` and let the event loop drain rather than calling
// process.exit(). Exiting hard from inside a promise callback kills the
// process while undici's keep-alive sockets are still closing, which trips a
// libuv assertion and returns exit code 9 — CI would read that as a failed
// ingest even though the run succeeded.
main()
  .catch((err) => {
    console.error("Ingest failed:", err);
    process.exitCode = 1;
  })
  .finally(closeDb);
