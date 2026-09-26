import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Meter, Tag } from "@/components/ui";
import { db, schema } from "@/lib/db";
import { compact, duration, pct } from "@/lib/format";
import { providerFor } from "@/lib/providers";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { requireUser } from "@/lib/session";
import { Composer } from "./composer";

export const metadata = { title: "Room" };

const minutesSince = (d: Date) => (Date.now() - d.getTime()) / 60_000;

export default async function RoomPage(props: PageProps<"/app/rooms/[id]">) {
  const { id } = await props.params;
  const viewer = await requireUser();
  const [row] = await db
    .select({ room: schema.room, account: schema.socialAccount })
    .from(schema.room)
    .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.room.accountId))
    .where(and(eq(schema.room.id, id), eq(schema.socialAccount.userId, viewer.user.id)))
    .limit(1);
  if (!row) notFound();
  const { room, account } = row;
  const provider = providerFor(account.platform);
  const b = room.breakdown;

  const ammo = room.topics.length
    ? await db.query.post.findFirst({
        where: and(eq(schema.post.accountId, account.id), inArray(schema.post.topic, room.topics), eq(schema.post.dated, false)),
        orderBy: desc(schema.post.likes),
      })
    : undefined;
  const previous = await db.query.reply.findFirst({ where: eq(schema.reply.roomId, room.id), orderBy: desc(schema.reply.createdAt) });
  const ageMin = minutesSince(room.postedAt);
  const windowLeft = Math.max(0, Math.round((b?.windowMinutes ?? 0) - minutesSince(room.fetchedAt)));

  return (
    <>
      <nav className="mb-6 text-[13px]">
        <Link href="/app/rooms" className="text-muted hover:text-ink">
          ← Rooms
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="label">
            {PLATFORM_LABEL[account.platform]} · replying as {account.handle}
          </p>
          <h1 className="mt-2 text-[22px] font-semibold">{room.authorName}</h1>
          <p className="text-[13px] text-muted">
            @{room.authorHandle}
            {room.authorFollowers !== null && ` · ${compact(room.authorFollowers)} followers`}
            {!room.manual && ` · ${duration(ageMin)} ago · ${room.replyCount} replies`}
          </p>
          <blockquote className="mt-4 whitespace-pre-wrap border-l-2 border-ink pl-4 text-[15px] leading-relaxed">{room.text}</blockquote>
          <a href={room.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[13px] underline underline-offset-4">
            Open on {PLATFORM_LABEL[account.platform]} ↗
          </a>

          <div className="mt-8">
            {room.status === "replied" && previous ? (
              <div className="border border-line p-4 text-[14px]">
                <p className="label mb-2">You replied · {previous.grade}</p>
                <p className="whitespace-pre-wrap">{previous.text}</p>
                {previous.url && (
                  <a href={previous.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] underline underline-offset-4">
                    View your reply ↗
                  </a>
                )}
              </div>
            ) : (
              <Composer
                roomId={room.id}
                canPost={provider.capabilities.post && !room.manual}
                planAllowsPost={viewer.limits.postFromTendril}
                platform={PLATFORM_LABEL[account.platform]}
                maxLength={account.platform === "x" ? 280 : account.platform === "bluesky" ? 300 : 500}
              />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-8">
          <div>
            <p className="label mb-3">Leverage {room.score}</p>
            {b && (
              <dl className="flex flex-col gap-3 text-[13px]">
                {[
                  ["Fit", b.fit, "How well you can speak to it"],
                  ["Early", b.early, "Room ahead of you"],
                  ["New reach", b.reach, "Readers who don't know you"],
                  ["Rapport", b.rapport, "Author likely to notice"],
                ].map(([k, v, hint]) => (
                  <div key={k as string}>
                    <div className="mb-1 flex justify-between">
                      <dt>{k as string}</dt>
                      <dd className="num text-muted">{Math.round((v as number) * 100)}</dd>
                    </div>
                    <Meter value={v as number} label={hint as string} />
                  </div>
                ))}
              </dl>
            )}
            {!room.manual && <p className="mt-4 text-[13px] text-muted">{windowLeft > 0 ? `Likely crowded in about ${duration(windowLeft)}.` : "This thread is getting crowded."}</p>}
          </div>
          {room.topics.length > 0 && (
            <div>
              <p className="label mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {room.topics.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </div>
          )}
          {ammo && (
            <div className="border-t border-line pt-4">
              <p className="label mb-2">You already wrote about this</p>
              <p className="text-[13px] text-ink-2">“{ammo.text.slice(0, 280)}”</p>
              <p className="mt-2 text-[12px] text-muted">
                {ammo.postedAt.toISOString().slice(0, 10)} · {ammo.likes} likes. Bring its core point in, in your own words.
              </p>
            </div>
          )}
          <p className="border-t border-line pt-4 text-[12px] text-muted">
            {pct(b?.reach ?? 0)} of this room is estimated not to know you yet. {account.platform === "bluesky" ? "Measured from accounts you follow who follow the author." : "Estimated from relative audience size."}
          </p>
        </aside>
      </div>
    </>
  );
}
