export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureLocalDatabase } = await import("./lib/db");
  await ensureLocalDatabase();
}
