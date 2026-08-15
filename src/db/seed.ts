/**
 * Seeds *reference data only*.
 *
 * There are deliberately no startups, funding rounds, shutdowns or investors
 * in here. Every one of those is a factual claim about a real company, and the
 * only two things allowed to make such a claim are the ingestion pipeline
 * (with a source URL attached) and a human running `npm run ingest:review`.
 * A seed file that invents a $41M round is worse than an empty database.
 *
 * What does belong here is the taxonomy: rows the design system needs in order
 * to render at all, which assert nothing about anyone.
 *
 * Run: npm run db:seed  — idempotent, safe to re-run.
 */

// `tsx` runs this file directly, outside Next, so nothing else loads .env.
// Without this line `db` has no connection string. `drizzle.config.ts` does
// the same thing for the same reason.
import "dotenv/config";

import { sql } from "drizzle-orm";

import { closeDb, db, tags } from "./index";

/**
 * The eight sectors, and the chart slot each one owns.
 *
 * `colorSlot` is the contract between the database and
 * `src/lib/chart-palette.ts`: colour follows the *entity*, never its rank, so
 * filtering a list must never repaint the sectors that survive the filter.
 * These indexes match the order the design proof used, so the palette on
 * screen is unchanged by the switch to real data.
 *
 * `other` must stay at slot 7 — it is the bucket a ninth sector folds into,
 * and the palette is validated for exactly eight.
 */
const SECTOR_TAGS = [
  { slug: "genai", label: "GenAI", colorSlot: 0 },
  { slug: "vision", label: "Vision", colorSlot: 1 },
  { slug: "speech", label: "Speech", colorSlot: 2 },
  { slug: "agents", label: "Agents", colorSlot: 3 },
  { slug: "infra", label: "Infra", colorSlot: 4 },
  { slug: "health-ai", label: "Health AI", colorSlot: 5 },
  { slug: "fintech-ai", label: "Fintech AI", colorSlot: 6 },
  { slug: "other", label: "Other", colorSlot: 7 },
];

async function main() {
  console.log("Seeding reference data…");

  // One statement, not eight — and one that needs no transaction around it.
  //
  // `onConflictDoUpdate` against the slug index is what makes re-running this
  // a no-op rather than a duplicate-key error, and it lets a label or slot
  // correction here propagate on the next run. `excluded` is the row Postgres
  // would have inserted.
  const rows = await db
    .insert(tags)
    .values(SECTOR_TAGS)
    .onConflictDoUpdate({
      target: tags.slug,
      set: {
        label: sql`excluded.label`,
        colorSlot: sql`excluded.color_slot`,
      },
    })
    .returning({ slug: tags.slug, colorSlot: tags.colorSlot });

  for (const r of rows) {
    console.log(`  ${r.slug.padEnd(12)} slot ${r.colorSlot}`);
  }
  console.log(`Done — ${rows.length} tags.`);
}

// `tsx` compiles this to CJS (package.json has no "type": "module"), so
// top-level await is unavailable — hence the explicit main().
//
// `exitCode` rather than `process.exit()`: exiting hard from a promise
// callback tears the process down while sockets are still closing, which
// trips a libuv assertion and reports failure on a successful run.
main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  // Releases the pool's idle connections so the process can exit on its own.
  .finally(closeDb);
