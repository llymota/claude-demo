export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDatabase } = await import("./lib/db");
  try {
    await ensureDatabase();
  } catch (err) {
    // Keep the server up so pages can show a useful error; the cause is printed here.
    console.error("Couldn't prepare the database. Check DATABASE_URL.", err);
  }
}
