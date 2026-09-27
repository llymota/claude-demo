"use server";

import { recentThreads, transcript } from "@/lib/ai/assistant";
import { requireUser } from "@/lib/session";

export async function listThreads() {
  const viewer = await requireUser();
  return (await recentThreads(viewer.user.id)).map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt.toISOString() }));
}

export async function loadThread(threadId: string) {
  const viewer = await requireUser();
  const t = await transcript(viewer.user.id, threadId);
  return t ? t.messages : [];
}
