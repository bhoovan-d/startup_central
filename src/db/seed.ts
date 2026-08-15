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

import { inArray, sql } from "drizzle-orm";

import { closeDb, db, tags } from "./index";

/**
 * The eight sectors, and the chart slot each one owns.
 *
 * `colorSlot` is the contract between the database and
 * `src/lib/chart-palette.ts`: colour follows the *entity*, never its rank, so
 * filtering a list must never repaint the sectors that survive the filter.
 * The palette is validated for exactly eight slots in this order — the labels
 * changed when the site broadened past AI, the slots did not.
 *
 * `other` must stay at slot 7 — it is the bucket a ninth sector folds into.
 */
const SECTOR_TAGS = [
  { slug: "fintech", label: "Fintech", colorSlot: 0 },
  { slug: "consumer", label: "Consumer", colorSlot: 1 },
  { slug: "saas", label: "SaaS", colorSlot: 2 },
  { slug: "mobility", label: "Mobility", colorSlot: 3 },
  { slug: "healthtech", label: "Healthtech", colorSlot: 4 },
  { slug: "edtech", label: "Edtech", colorSlot: 5 },
  { slug: "deeptech", label: "Deeptech", colorSlot: 6 },
  { slug: "other", label: "Other", colorSlot: 7 },
];

/**
 * Sector slugs the site no longer uses.
 *
 * The old AI-only taxonomy is deleted rather than left in place: `listTags`
 * drives the filter chips straight from this table, so a stale row shows up
 * as a filter that can never match anything. Deleting cascades to
 * `startup_tags`, which is why this runs before any tagging exists — after
 * that it would silently drop classifications and would need a remap instead.
 */
const RETIRED_TAGS = [
  "genai", "vision", "speech", "agents", "infra", "health-ai", "fintech-ai",
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

  // Guard, not paranoia: this deletes rows, and the FK from `startup_tags`
  // cascades. Refusing to run once anything is classified turns a silent data
  // loss into a message asking for a remap.
  const [tagged] = (
    await db.execute<{ n: number }>(sql`select count(*)::int as n from startup_tags`)
  ).rows;

  if (tagged && tagged.n > 0) {
    console.log(
      `\n  ${tagged.n} companies are tagged — leaving retired sectors alone.\n` +
        "  Remap them before removing the old taxonomy.",
    );
  } else {
    const removed = await db
      .delete(tags)
      .where(inArray(tags.slug, RETIRED_TAGS))
      .returning({ slug: tags.slug });
    if (removed.length > 0) {
      console.log(`  retired ${removed.map((r) => r.slug).join(", ")}`);
    }
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
