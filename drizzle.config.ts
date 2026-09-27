import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Without DATABASE_URL, Studio opens the embedded development database.
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
  strict: true,
});
