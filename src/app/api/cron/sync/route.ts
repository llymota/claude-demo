import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { dueAutopilotUsers, runAutopilot, triageAfterSync } from "@/lib/autopilot";
import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { dueAccounts, pruneOldData, syncAccount } from "@/lib/sync";

export const maxDuration = 300;

const BUDGET_MS = 240_000;
const CONCURRENCY = 4;

/** Background sync. Vercel Cron (see vercel.json) or any scheduler calls this with the CRON_SECRET bearer token. */
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${env().CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const started = Date.now();
  const queue = await dueAccounts(60);
  const touched = queue.length ? (await db.query.socialAccount.findMany({ where: inArray(schema.socialAccount.id, queue), columns: { userId: true } })).map((a) => a.userId) : [];
  let synced = 0;
  let failed = 0;

  async function worker() {
    while (queue.length && Date.now() - started < BUDGET_MS * 0.6) {
      const id = queue.shift()!;
      const ok = await syncAccount(id);
      if (ok) synced++;
      else failed++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Triage what just arrived, then give due users their daily Autopilot pass.
  for (const userId of new Set(touched)) {
    if (Date.now() - started > BUDGET_MS * 0.75) break;
    await triageAfterSync(userId);
  }
  const autopilot = await dueAutopilotUsers();
  let ran = 0;
  for (const userId of autopilot) {
    if (Date.now() - started > BUDGET_MS) break;
    const r = await runAutopilot(userId);
    if (!r.skipped) ran++;
  }
  await pruneOldData().catch((err) => log.warn("cron.prune_failed", { error: err }));

  log.info("cron.sync", { synced, failed, remaining: queue.length, autopilot: ran, ms: Date.now() - started });
  return NextResponse.json({ synced, failed, remaining: queue.length, autopilot: ran });
}
