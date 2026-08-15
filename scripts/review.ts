/**
 * Works the ingestion review queue.
 *
 *   npm run ingest:review
 *   npm run ingest:review -- --stats
 *   npm run ingest:review -- --reject-older-than 60
 *
 * This is the human in the loop, and for now it stands in for the `/admin`
 * screen described in .env.example — same job, no auth surface to build or
 * secure. It is also the ONLY place in the system that creates a `startups`
 * row: ingestion deliberately never does, because saying "this company exists
 * and this is its name" is a claim a person should make.
 */

// tsx doesn't load .env. See src/db/seed.ts.
import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { and, desc, eq, lt, sql } from "drizzle-orm";

import { closeDb, db, newsItems, startups } from "@/db";
import { ExtractedEvent } from "@/lib/ingest/schema";
import { normalizeName, slugify } from "@/lib/ingest/normalize";
import { writeRound } from "@/lib/ingest/persist";

const rl = createInterface({ input: stdin, output: stdout });

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function stats() {
  const rows = await db.execute<{ status: string; n: number }>(sql`
    select status, count(*)::int as n from news_items group by status order by n desc
  `);
  console.log("Review queue:");
  for (const r of rows.rows) console.log(`  ${r.status.padEnd(16)} ${r.n}`);
}

async function rejectOlderThan(days: number) {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .update(newsItems)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(newsItems.status, "pending"), lt(newsItems.createdAt, cutoff)))
    .returning({ id: newsItems.id });
  console.log(`Rejected ${rows.length} items older than ${days} days.`);
}

/**
 * Creates a company from a reviewed article, or binds to an existing one.
 *
 * `verified` is left at its default of false: a human has confirmed the
 * company is real and correctly named, which is not the same as having
 * checked every field on the record.
 */
async function createStartup(name: string, sourceUrl: string) {
  const normalized = normalizeName(name);
  const existing = await db.query.startups.findFirst({
    columns: { id: true, slug: true, name: true },
    where: eq(startups.normalizedName, normalized),
  });
  if (existing) return existing;

  const rows = await db
    .insert(startups)
    .values({
      slug: slugify(name),
      name,
      normalizedName: normalized,
      sourceUrls: [sourceUrl],
    })
    .returning({ id: startups.id, slug: startups.slug, name: startups.name });

  return rows[0]!;
}

async function review() {
  const queue = await db.query.newsItems.findMany({
    where: eq(newsItems.status, "pending"),
    orderBy: [desc(newsItems.publishedAt), desc(newsItems.id)],
    limit: 100,
  });

  if (queue.length === 0) {
    console.log("Queue is empty.");
    return;
  }

  console.log(`${queue.length} pending item(s). [a]pprove [b]ind [r]eject [s]kip [o]pen [q]uit\n`);

  for (const item of queue) {
    const parsed = item.extracted
      ? ExtractedEvent.safeParse(JSON.parse(item.extracted))
      : null;
    const event = parsed?.success ? parsed.data : null;

    console.log("─".repeat(72));
    console.log(item.title);
    console.log(`  ${item.sourceName} · ${item.publishedAt?.toISOString().slice(0, 10) ?? "no date"}`);
    console.log(`  ${item.url}`);
    if (item.excerpt) console.log(`  "${item.excerpt}"`);
    if (event) {
      console.log(
        `  → ${event.eventType} | ${event.companyName ?? "(no company)"} | ` +
          `${event.roundType ?? "-"} | usd=${event.amountUsd ?? "-"} inr=${event.amountInr ?? "-"} | ` +
          `date=${event.announcedDate ?? "-"} | conf=${event.confidence.toFixed(2)}`,
      );
    } else {
      console.log("  → no usable extraction");
    }

    const answer = (await rl.question("  action> ")).trim().toLowerCase();
    const [action, arg] = answer.split(/\s+/);

    if (action === "q") break;
    if (action === "s" || action === "") continue;

    if (action === "o") {
      console.log(`  ${item.url}`);
      continue;
    }

    if (action === "r") {
      await db
        .update(newsItems)
        .set({ status: "rejected", reviewedAt: new Date() })
        .where(eq(newsItems.id, item.id));
      console.log("  rejected");
      continue;
    }

    if (action === "a" || action === "b") {
      if (!event || event.eventType !== "funding" || !event.announcedDate) {
        console.log("  cannot approve: needs a funding event with a date. Rejecting instead is fine.");
        continue;
      }

      let startup: { id: number; slug: string; name: string } | undefined;

      if (action === "b") {
        if (!arg) {
          console.log("  usage: b <existing-startup-slug>");
          continue;
        }
        startup = await db.query.startups.findFirst({
          columns: { id: true, slug: true, name: true },
          where: eq(startups.slug, arg),
        });
        if (!startup) {
          console.log(`  no startup with slug "${arg}"`);
          continue;
        }
      } else {
        const name = event.companyName ?? (await rl.question("  company name> ")).trim();
        if (!name) {
          console.log("  skipped: no company name");
          continue;
        }
        startup = await createStartup(name, item.url);
      }

      const written = await writeRound(startup.id, event, {
        url: item.url,
        name: item.sourceName,
      });

      await db
        .update(newsItems)
        .set({
          status: "approved",
          resolvedStartupId: startup.id,
          reviewedAt: new Date(),
        })
        .where(eq(newsItems.id, item.id));

      console.log(
        written.status === "written"
          ? `  approved → ${startup.slug} (round #${written.roundId})`
          : written.status === "duplicate"
            ? `  approved → ${startup.slug} (round already recorded)`
            : `  approved → ${startup.slug} (no round: ${written.reason})`,
      );
    }
  }
}

async function main() {
  const older = flag("reject-older-than");

  if (process.argv.includes("--stats")) return stats();
  if (older) return rejectOlderThan(Number(older));
  return review();
}

// Closing readline releases stdin so the process can exit on its own. See the
// note in scripts/ingest.ts for why this isn't process.exit().
main()
  .catch((err) => {
    console.error("Review failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await closeDb();
  });
