// Applies SQL migrations in ./drizzle. Runs on every Vercel build (see "vercel-build").
// Without DATABASE_URL it migrates the embedded development database instead.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import nextEnv from "@next/env";

// Read .env.local and friends the same way `next dev` does, so this migrates the database the app uses.
nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL || undefined;
if (url) {
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(".data/pglite");
  await migratePglite(drizzlePglite({ client }), { migrationsFolder: "./drizzle" });
  await client.close();
}
console.log("migrations applied");
