import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Migrations run against `DIRECT_URL` when it is set, falling back to
 * `DATABASE_URL`.
 *
 * On Supabase the app connects through the transaction pooler (port 6543),
 * which multiplexes statements across backends and is the wrong place to run
 * DDL — advisory locks and session state don't survive it, and drizzle-kit
 * relies on both. The direct connection (port 5432) is what migrations want.
 *
 * The fallback keeps a single-URL setup working: a plain Postgres instance, or
 * a Supabase project reached directly, needs no DIRECT_URL at all.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Set DATABASE_URL (and DIRECT_URL on Supabase) before running drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
