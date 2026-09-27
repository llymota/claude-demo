import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/session";

/** GDPR-style export of everything stored for the signed-in user. Tokens are never included. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const userId = session.user.id;
  const accounts = await db.query.socialAccount.findMany({ where: eq(schema.socialAccount.userId, userId), columns: { credentials: false } });
  const ids = accounts.map((a) => a.id);
  const any = ids.length > 0;
  const [workspace, subscription, rooms, replies, people, posts, snapshots, attribution] = await Promise.all([
    db.query.workspace.findFirst({ where: eq(schema.workspace.userId, userId) }),
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, userId) }),
    any ? db.query.room.findMany({ where: inArray(schema.room.accountId, ids) }) : [],
    db.query.reply.findMany({ where: eq(schema.reply.userId, userId) }),
    any ? db.query.person.findMany({ where: inArray(schema.person.accountId, ids) }) : [],
    any ? db.query.post.findMany({ where: inArray(schema.post.accountId, ids) }) : [],
    any ? db.query.followerSnapshot.findMany({ where: inArray(schema.followerSnapshot.accountId, ids) }) : [],
    any ? db.query.followAttribution.findMany({ where: inArray(schema.followAttribution.accountId, ids) }) : [],
  ]);
  const personIds = people.map((p) => p.id);
  const interactions = personIds.length ? await db.query.interaction.findMany({ where: inArray(schema.interaction.personId, personIds) }) : [];
  const [drafts, threads, aiUsage] = await Promise.all([
    db.query.draft.findMany({ where: eq(schema.draft.userId, userId) }),
    db.query.aiThread.findMany({ where: eq(schema.aiThread.userId, userId) }),
    db.query.aiUsage.findMany({ where: eq(schema.aiUsage.userId, userId) }),
  ]);
  const threadIds = threads.map((t) => t.id);
  const aiMessages = threadIds.length ? await db.query.aiMessage.findMany({ where: inArray(schema.aiMessage.threadId, threadIds) }) : [];
  const body = {
    exportedAt: new Date().toISOString(),
    user: { id: userId, name: session.user.name, email: session.user.email, createdAt: session.user.createdAt },
    workspace,
    subscription,
    accounts,
    rooms,
    replies,
    people,
    interactions,
    posts,
    followerSnapshots: snapshots,
    followAttribution: attribution,
    drafts,
    assistant: threads.map((t) => ({ ...t, messages: aiMessages.filter((m) => m.threadId === t.id) })),
    aiUsage,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="tendril-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
