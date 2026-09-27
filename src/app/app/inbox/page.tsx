import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ButtonLink, Empty, PageHeader, Section } from "@/components/ui";
import { db, schema } from "@/lib/db";
import { features } from "@/lib/env";
import { clip, relative } from "@/lib/format";
import { providerFor } from "@/lib/providers";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { requireUser } from "@/lib/session";
import { RunAutopilot } from "../_components/run-autopilot";
import { DraftCard } from "./draft-card";

export const metadata = { title: "Inbox" };

const KIND = { reply: "Reply", checkin: "Check-in", reshare: "Reshare" } as const;

export default async function InboxPage() {
  const viewer = await requireUser();
  const accounts = await db.query.socialAccount.findMany({ where: eq(schema.socialAccount.userId, viewer.user.id) });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const [pending, recent] = await Promise.all([
    db.query.draft.findMany({ where: and(eq(schema.draft.userId, viewer.user.id), eq(schema.draft.status, "pending")), orderBy: desc(schema.draft.createdAt), limit: 50 }),
    db.query.draft.findMany({ where: and(eq(schema.draft.userId, viewer.user.id), inArray(schema.draft.status, ["posted", "discarded"])), orderBy: desc(schema.draft.decidedAt), limit: 10 }),
  ]);
  const roomIds = pending.map((d) => d.roomId).filter((x): x is string => Boolean(x));
  const personIds = pending.map((d) => d.personId).filter((x): x is string => Boolean(x));
  const postIds = pending.map((d) => d.postId).filter((x): x is string => Boolean(x));
  const [rooms, people, posts] = await Promise.all([
    roomIds.length ? db.query.room.findMany({ where: inArray(schema.room.id, roomIds) }) : [],
    personIds.length ? db.query.person.findMany({ where: inArray(schema.person.id, personIds) }) : [],
    postIds.length ? db.query.post.findMany({ where: inArray(schema.post.id, postIds) }) : [],
  ]);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const personMap = new Map(people.map((p) => [p.id, p]));
  const postMap = new Map(posts.map((p) => [p.id, p]));

  const items = pending
    .map((d) => {
      const acct = byId.get(d.accountId);
      if (!acct) return null;
      const provider = providerFor(acct.platform);
      const room = d.roomId ? roomMap.get(d.roomId) : undefined;
      if (d.kind === "reply" && (!room || room.status !== "open")) return null;
      const person = d.personId ? personMap.get(d.personId) : undefined;
      const post = d.postId ? postMap.get(d.postId) : undefined;
      const context =
        d.kind === "reply" && room
          ? { title: `${room.authorName} · @${room.authorHandle}`, body: room.text, href: `/app/rooms/${room.id}`, external: room.url }
          : d.kind === "checkin" && person
            ? { title: `${person.name} · @${person.handle}`, body: person.aiBrief ?? "", href: `/app/circles#${person.id}`, external: null }
            : post
              ? { title: `Your post from ${post.postedAt.toISOString().slice(0, 10)}`, body: post.text, href: `/app/second-life#${post.id}`, external: post.url }
              : null;
      if (!context) return null;
      const canPost = d.kind !== "checkin" && provider.capabilities.post && viewer.limits.postFromTendril && !(room?.manual ?? false);
      return {
        id: d.id,
        kind: KIND[d.kind],
        account: `${acct.handle} · ${PLATFORM_LABEL[acct.platform]}`,
        platform: PLATFORM_LABEL[acct.platform],
        text: d.text,
        rationale: d.rationale,
        created: relative(d.createdAt),
        context: { ...context, body: clip(context.body, 600) },
        canPost,
        isCheckin: d.kind === "checkin",
        maxLength: acct.platform === "x" ? 280 : acct.platform === "bluesky" ? 300 : 500,
        gradeRoomId: features.jev() && d.kind !== "checkin" && d.roomId ? d.roomId : null,
      };
    })
    .filter((x) => x !== null);

  const aiOn = features.ai();

  return (
    <>
      <PageHeader
        label="Inbox"
        title="Ready for your approval"
        actions={viewer.limits.autopilot && aiOn ? <RunAutopilot /> : undefined}
      >
        Autopilot prepares these in your voice. Edit anything, then post, copy or discard. Nothing goes out without you.
      </PageHeader>

      {!aiOn ? (
        <div className="pt-8">
          <Empty title="AI isn't configured">Set ANTHROPIC_API_KEY on the server to turn on Autopilot and the assistant.</Empty>
        </div>
      ) : !viewer.limits.autopilot && items.length === 0 ? (
        <div className="pt-8">
          <Empty title="Autopilot is part of Grower" action={<ButtonLink href="/app/settings/billing" variant="primary">See plans</ButtonLink>}>
            Every morning it triages new rooms, drafts replies in your voice, prepares check-ins with people going cold, and picks a post to resurface.
          </Empty>
        </div>
      ) : items.length === 0 ? (
        <div className="pt-8">
          <Empty title="Inbox zero">Autopilot runs every morning. You can also ask for a draft from any room, or from the assistant with ⌘K.</Empty>
        </div>
      ) : (
        <Section title={`${items.length} waiting`}>
          <ol className="flex flex-col gap-6">
            {items.map((i) => (
              <li key={i.id}>
                <DraftCard draft={i} />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recently decided">
          <ul className="border-t border-line text-[13px]">
            {recent.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
                <span className="min-w-0 truncate">
                  <span className="label mr-2">{KIND[d.kind]}</span>
                  {clip(d.text, 110)}
                </span>
                <span className="shrink-0 text-muted">
                  {d.status === "posted" ? (d.resultUrl ? <a href={d.resultUrl} target="_blank" rel="noopener noreferrer" className="underline">Posted</a> : d.source === "autopilot-auto" ? "Auto-reshared" : "Sent") : "Discarded"} · {relative(d.decidedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="mt-8 text-[12px] text-muted">
        Drafts expire with their room. Tune how many Autopilot prepares in <Link href="/app/settings/autopilot" className="underline">Settings</Link>.
      </p>
    </>
  );
}
