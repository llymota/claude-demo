import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/* eslint-disable @typescript-eslint/no-require-imports -- the embedded database is loaded lazily so production never pulls in its WASM build */

type DB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __tendrilDb?: DB; __tendrilReady?: Promise<void> };

/** Embedded Postgres for local development when DATABASE_URL is unset. Data lives in ./.data/pglite. */
export const PGLITE_DIR = ".data/pglite";

function create(): DB {
  const url = env().DATABASE_URL;
  if (!url) {
    // Loaded lazily so production bundles never pull in the WASM build.
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const client = new PGlite(PGLITE_DIR);
    return drizzlePglite({ client, schema, casing: "snake_case" }) as unknown as DB;
  }
  const sql = postgres(url, {
    max: env().NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    prepare: false, // compatible with transaction-mode poolers (PgBouncer, Supabase, Neon)
  });
  return drizzle(sql, { schema, casing: "snake_case" });
}

const instance = () => globalForDb.__tendrilDb ?? (globalForDb.__tendrilDb = create());

/**
 * One pool per process, reused across hot reloads in development. Created on first use
 * so importing this module (for example while Next collects routes at build time)
 * never needs a database or secrets.
 */
export const db: DB = new Proxy({} as DB, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/**
 * Brings the database schema up to date when the server starts, so a fresh database
 * (the embedded one, or a new Supabase or Neon project) works without a separate step.
 * On Vercel, the build runs migrations instead (see "vercel-build"), since many
 * serverless instances starting at once shouldn't all migrate.
 */
export function ensureDatabase() {
  if (process.env.VERCEL) return Promise.resolve();
  globalForDb.__tendrilReady ??= (async () => {
    if (env().DATABASE_URL) {
      const { migrate } = require("drizzle-orm/postgres-js/migrator") as typeof import("drizzle-orm/postgres-js/migrator");
      await migrate(instance(), { migrationsFolder: "./drizzle" });
    } else {
      const { migrate } = require("drizzle-orm/pglite/migrator") as typeof import("drizzle-orm/pglite/migrator");
      await migrate(instance() as never, { migrationsFolder: "./drizzle" });
    }
  })();
  return globalForDb.__tendrilReady;
}

export { schema };
