import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __tendrilDb?: DB; __tendrilSql?: postgres.Sql };

function create() {
  const sql = postgres(env().DATABASE_URL, {
    max: env().NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    prepare: false, // compatible with transaction-mode poolers (PgBouncer, Supabase, Neon)
  });
  globalForDb.__tendrilSql = sql;
  return drizzle(sql, { schema, casing: "snake_case" });
}

/** One pool per process; reused across hot reloads in development. */
export const db: DB = globalForDb.__tendrilDb ?? (globalForDb.__tendrilDb = create());

export { schema };
