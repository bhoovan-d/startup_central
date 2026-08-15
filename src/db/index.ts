import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Postgres client, tuned for Supabase.
 *
 * `node-postgres` rather than `postgres-js`, which is the more common Supabase
 * pairing, for one concrete reason: `db.execute()` here returns `{ rows }`,
 * the same shape the raw-SQL queries in `src/lib/queries/{stats,search}.ts`
 * already read. `postgres-js` returns a bare array, so every one of those
 * would silently return undefined.
 *
 * Connect through Supabase's **transaction pooler** (port 6543), not the
 * direct connection. Two reasons: this deploys serverless, so each instance
 * would otherwise hold a real Postgres backend open; and Supabase's direct
 * connection is IPv6-only, which most serverless platforms can't reach.
 * `db:migrate` is the exception — see DIRECT_URL in drizzle.config.ts.
 */
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }

  const { url, ssl } = resolveSsl(connectionString);

  return new Pool({
    connectionString: url,
    ssl,
    // Supavisor multiplexes in transaction mode, so this pool only needs to
    // cover the queries one instance runs concurrently — the homepage fans out
    // across a handful of Suspense boundaries, and the list pages issue their
    // rows and count together. Small enough not to exhaust the pooler when
    // many instances are warm.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Decides TLS settings independently of whatever `sslmode` the URL carries.
 *
 * `pg` 8.23 resolves `sslmode` from the connection string and that resolution
 * beats an explicit `ssl` option, so a pasted Supabase URL — which ships with
 * `sslmode=require` — is decisive. Since 8.23 that value is treated as an
 * alias for `verify-full`, which demands a locally trusted CA chain and fails
 * against Supabase's pooler with SELF_SIGNED_CERT_IN_CHAIN.
 *
 * Stripping the parameter and setting `ssl` here means the app works with
 * whichever connection string someone pastes into their host's dashboard,
 * rather than depending on them having hand-edited it. Connections are still
 * TLS-encrypted; the chain just isn't verified, which is what `require` has
 * always meant in libpq. To harden further, pull Supabase's CA certificate
 * and pass `{ ca, rejectUnauthorized: true }`.
 *
 * Local Postgres, which typically has no TLS at all, is left alone.
 */
function resolveSsl(connectionString: string): {
  url: string;
  ssl: false | { rejectUnauthorized: boolean };
} {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return { url: connectionString, ssl: false };
  }

  const host = parsed.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocal) return { url: connectionString, ssl: false };

  parsed.searchParams.delete("sslmode");
  return { url: parsed.toString(), ssl: { rejectUnauthorized: false } };
}

/**
 * Cached across hot reloads.
 *
 * Without this, every edit in `next dev` re-evaluates the module and opens a
 * fresh pool while the old one keeps its connections — you exhaust the pooler
 * after a few dozen saves. Production evaluates the module once, so the global
 * is only load-bearing in development.
 */
const globalForDb = globalThis as unknown as { __pool?: Pool };

let client: Db | undefined;

function connect(): Db {
  if (!client) {
    globalForDb.__pool ??= createPool();
    client = drizzle(globalForDb.__pool, { schema });
  }
  return client;
}

/**
 * The Drizzle client, connected lazily on first query.
 *
 * The laziness is load-bearing, not tidiness. This module used to throw at
 * import time, which meant one missing env var took down `next build` in its
 * entirety — including routes that never touch the database — because merely
 * importing a query file was enough to trigger it. Deferring the throw to the
 * first actual query turns that into a single failing route.
 *
 * A Proxy rather than a `getDb()` function so every call site reads as plain
 * `db.select()`, and so `export * from "./schema"` below stays the only other
 * thing consumers need.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(connect(), prop, receiver);
  },
});

/**
 * Closes the pool. Call at the end of a script, never from a request handler.
 *
 * `tsx` scripts keep the process alive while the pool holds idle connections,
 * so `npm run db:seed` would otherwise hang after finishing its work.
 */
export async function closeDb(): Promise<void> {
  if (globalForDb.__pool) {
    await globalForDb.__pool.end();
    globalForDb.__pool = undefined;
    client = undefined;
  }
}

export * from "./schema";
