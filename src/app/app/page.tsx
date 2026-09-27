import Link from "next/link";
import { ButtonLink, Empty, PageHeader, Section, Stat, Tag } from "@/components/ui";
import { clip, compact, duration, pct } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { accountsFor, circles, completions, ledger, localDay, openRooms, secondLife, storefront } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { RoundCheck } from "./_components/round-check";
import { AskButton } from "./_components/assistant";
import { RunAutopilot } from "./_components/run-autopilot";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { features } from "@/lib/env";

export const metadata = { title: "Today" };

interface Item {
  key: string;
  kind: string;
  minutes: number;
  title: string;
  meta: string[];
  href: string;
  action: string;
}

export default async function TodayPage() {
  const viewer = await requireUser();
  const accounts = await accountsFor(viewer.user.id);
  const ids = accounts.map((a) => a.id);
  const day = localDay(viewer.workspace.timezone);

  const [[{ inbox }], rooms, people, archive, done, led] = await Promise.all([
    db.select({ inbox: count() }).from(schema.draft).where(and(eq(schema.draft.userId, viewer.user.id), eq(schema.draft.status, "pending"))),
    openRooms(viewer, ids),
    viewer.limits.circles ? circles(ids) : Promise.resolve({ people: [], nudges: [] }),
    viewer.limits.secondLife ? secondLife(accounts, viewer.workspace.topics) : Promise.resolve([]),
    completions(viewer.user.id, day),
    ledger(ids, 1),
  ]);

  const items: Item[] = [
    ...rooms.slice(0, 3).map((r) => ({
      key: `room:${r.id}`,
      kind: "Join a room",
      minutes: 3,
      title: `${r.authorName}: “${clip(r.text, 90)}”`,
      meta: [`Leverage ${r.score}`, `Window ${duration(r.windowLeft)}`, `${pct(1 - r.audienceOverlap)} new to you`, ...(r.aiVerdict === "strong" ? ["Autopilot: worth it"] : [])],
      href: `/app/rooms/${r.id}`,
      action: "Write reply",
    })),
    ...people.nudges.slice(0, 2).map((n) => ({
      key: `person:${n.personId}`,
      kind: "Tend a relationship",
      minutes: 2,
      title: `Check in with ${n.person.name}`,
      meta: [n.reason],
      href: `/app/circles#${n.personId}`,
      action: "See context",
    })),
    ...archive
      .filter((a) => a.score >= 50)
      .slice(0, 1)
      .map((a) => ({
        key: `post:${a.id}`,
        kind: "Second Life",
        minutes: 2,
        title: `Resurface “${clip(a.text, 80)}”`,
        meta: [`${pct(a.unseen)} of today's followers never saw it`],
        href: `/app/second-life#${a.id}`,
        action: "Open",
      })),
    ...(accounts[0]
      ? storefront(accounts[0], viewer.workspace.topics)
          .filter((c) => !c.ok)
          .slice(0, 1)
          .map((c) => ({
            key: `store:${c.id}`,
            kind: "Storefront",
            minutes: 3,
            title: `Fix your profile: ${c.label.toLowerCase()}`,
            meta: [clip(c.detail, 100)],
            href: "/app/storefront",
            action: "Fix it",
          }))
      : []),
  ];

  const doneCount = items.filter((i) => done.has(i.key)).length;
  const minutes = items.filter((i) => !done.has(i.key)).reduce((n, i) => n + i.minutes, 0);
  const followers = accounts.reduce((n, a) => n + a.followers, 0);
  const week = led.weekly.at(-1);
  const weekTotal = week ? week.replies + week.relationships + week.resurfaced + week.profile + week.unattributed : 0;
  const greeting = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: viewer.workspace.timezone }).format(new Date());

  return (
    <>
      <PageHeader label={greeting} title={`Good ${partOfDay(viewer.workspace.timezone)}, ${viewer.user.name.split(" ")[0]}.`}>
        {accounts.length === 0
          ? "Connect an account and Tendril will build your first round."
          : `${rooms.length} open ${rooms.length === 1 ? "room" : "rooms"} where people haven't met you yet. No new posts needed.`}
      </PageHeader>

      {accounts.length > 0 && features.ai() && (
        <AutopilotStrip
          brief={viewer.workspace.morningBrief?.day === day ? viewer.workspace.morningBrief : null}
          weekly={viewer.workspace.weeklyReview}
          inbox={inbox}
          allowed={viewer.limits.autopilot}
        />
      )}

      {accounts.length === 0 ? (
        <div className="pt-8">
          <Empty title="No accounts connected" action={<ButtonLink href="/app/settings/accounts" variant="primary">Connect an account</ButtonLink>}>
            Tendril reads public conversations and your own posts. It never posts without you pressing a button.
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 border border-line sm:grid-cols-3 [&>*+*]:border-t [&>*+*]:border-line sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-l">
            <Stat label="Followers" value={compact(followers)} note={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`} />
            <Stat label="New this week" value={weekTotal ? `+${weekTotal}` : "0"} note={week?.replies ? `${week.replies} from replies` : "Tracked from your first sync"} />
            <Stat label="Round" value={`${doneCount}/${items.length}`} note={minutes ? `About ${minutes} minutes left` : "Done for today"} />
          </div>

          <Section title="Today's round" meta={doneCount === items.length && items.length > 0 ? "Complete" : undefined}>
            {items.length === 0 ? (
              <Empty title="Nothing to do yet">
                {accounts.some((a) => !a.lastSyncedAt) ? "Your first sync is running. Rooms appear within a few minutes." : "No open rooms match your topics right now. Add keywords in Settings to widen the search."}
              </Empty>
            ) : (
              <ol className="border-t border-line">
                {items.map((i) => {
                  const isDone = done.has(i.key);
                  return (
                    <li key={i.key} className="grid grid-cols-[18px_minmax(0,1fr)] gap-4 border-b border-line py-4 sm:grid-cols-[18px_minmax(0,1fr)_auto]">
                      <RoundCheck itemKey={i.key} done={isDone} label={`Mark done: ${i.title}`} />
                      <div className="min-w-0">
                        <p className="label">
                          {i.kind} · {i.minutes} min
                        </p>
                        <p className={`mt-1 font-medium ${isDone ? "text-muted line-through" : ""}`}>{i.title}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {i.meta.map((m) => (
                            <Tag key={m}>{m}</Tag>
                          ))}
                        </div>
                      </div>
                      <Link href={i.href} className="col-start-2 text-[13px] font-medium underline underline-offset-4 sm:col-start-3 sm:self-center">
                        {i.action}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <Section title="Accounts">
            <div className="overflow-x-auto border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="label px-4 py-2.5 font-normal">Account</th>
                    <th className="label px-4 py-2.5 text-right font-normal">Followers</th>
                    <th className="label px-4 py-2.5 font-normal">Last sync</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{a.handle}</span> <span className="text-muted">· {PLATFORM_LABEL[a.platform]}</span>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{a.followers.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-muted">{a.status === "reauth" ? "Needs reconnecting" : a.lastSyncedAt ? a.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "Syncing…"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  );
}

function AutopilotStrip({ brief, weekly, inbox, allowed }: { brief: { headline: string; body: string } | null; weekly: { headline: string; body: string; day: string } | null; inbox: number; allowed: boolean }) {
  return (
    <div className="mt-8 grid border border-ink md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="p-5">
        <p className="label !text-ink">Morning brief</p>
        {brief ? (
          <>
            <p className="mt-2 text-[17px] font-semibold leading-snug">{brief.headline}</p>
            <p className="mt-2 text-ink-2">{brief.body}</p>
          </>
        ) : allowed ? (
          <p className="mt-2 text-ink-2">Autopilot hasn&apos;t run today yet. It runs each morning, or start it now.</p>
        ) : (
          <p className="mt-2 text-ink-2">
            Autopilot triages rooms, drafts replies in your voice and writes this brief every morning.{" "}
            <Link href="/app/settings/billing" className="underline underline-offset-2">
              It&apos;s part of Grower.
            </Link>
          </p>
        )}
        {weekly && (
          <details className="mt-4 border-t border-line pt-3 text-[13px]">
            <summary className="cursor-pointer font-medium">Weekly review: {weekly.headline}</summary>
            <p className="mt-2 text-ink-2">{weekly.body}</p>
          </details>
        )}
        <div className="mt-4 flex flex-wrap gap-4">
          <AskButton question="What should I focus on today, and why?">Ask about today</AskButton>
          {allowed && !brief && <RunAutopilot />}
        </div>
      </div>
      <Link href="/app/inbox" className="flex flex-col justify-between border-t border-ink p-5 transition hover:bg-subtle md:border-t-0 md:border-l">
        <span className="label !text-ink">Inbox</span>
        <span className="num mt-3 text-[40px] leading-none">{inbox}</span>
        <span className="mt-2 text-[13px] text-ink-2">{inbox === 1 ? "draft waits" : "drafts wait"} for your approval →</span>
      </Link>
    </div>
  );
}

function partOfDay(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
