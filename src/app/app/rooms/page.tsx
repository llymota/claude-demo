import Link from "next/link";
import { Empty, PageHeader, Tag, ButtonLink } from "@/components/ui";
import { compact, duration, pct } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { accountsFor, openRooms } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { AddRoom } from "./add-room";

export const metadata = { title: "Rooms" };

export default async function RoomsPage(props: PageProps<"/app/rooms">) {
  const viewer = await requireUser();
  const accounts = await accountsFor(viewer.user.id);
  const q = await props.searchParams;
  const filter = typeof q.account === "string" ? q.account : null;
  const ids = accounts.filter((a) => !filter || a.id === filter).map((a) => a.id);
  const rooms = await openRooms(viewer, ids);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const capped = Number.isFinite(viewer.limits.roomsPerDay);

  return (
    <>
      <PageHeader
        label="Rooms"
        title="Conversations worth joining"
        actions={accounts.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <FilterLink href="/app/rooms" active={!filter}>All</FilterLink>
            {accounts.map((a) => (
              <FilterLink key={a.id} href={`/app/rooms?account=${a.id}`} active={filter === a.id}>
                {PLATFORM_LABEL[a.platform]}
              </FilterLink>
            ))}
          </div>
        )}
      >
        Ranked by how well you can speak to the topic, how early you are, how much of the room has never seen you, and how likely the author is to notice.
        Crowded threads drop off.
      </PageHeader>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {rooms.length === 0 ? (
            <Empty title="No open rooms right now">
              {accounts.length === 0 ? "Connect an account to start finding conversations." : "Tendril searches again every sync. Broader keywords in Settings find more rooms."}
            </Empty>
          ) : (
            <ol className="border-t border-line">
              {rooms.map((r) => {
                const acct = byId.get(r.accountId)!;
                const b = r.breakdown;
                return (
                  <li key={r.id} className="border-b border-line">
                    <Link href={`/app/rooms/${r.id}`} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 py-4 transition hover:bg-subtle sm:px-2">
                      <span className="num flex h-12 w-12 flex-col items-center justify-center border border-ink text-[18px] leading-none">
                        {r.score}
                        <span className="mt-1 text-[9px] tracking-wider text-muted">LEV</span>
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
                          <span className="font-medium text-ink">{r.authorName}</span>
                          <span>@{r.authorHandle}</span>
                          <span>· {PLATFORM_LABEL[acct.platform]}</span>
                          {r.authorFollowers !== null && <span>· {compact(r.authorFollowers)} followers</span>}
                          <span>· {r.manual ? "added by you" : `${duration(r.ageMinutes)} ago`}</span>
                        </span>
                        <span className="mt-1 line-clamp-3 block text-[14px] text-ink-2">{r.text}</span>
                        {r.aiAngle && (
                          <span className="mt-1.5 block text-[13px]">
                            <span className="font-medium">Your angle:</span> <span className="text-ink-2">{r.aiAngle}</span>
                          </span>
                        )}
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {r.aiVerdict === "strong" && <Tag strong>Autopilot: worth it</Tag>}
                          {r.aiVerdict === "maybe" && <Tag>Autopilot: maybe</Tag>}
                          {!r.manual && <Tag strong={r.windowLeft < 30}>{r.windowLeft < 30 ? `Closing in ${duration(r.windowLeft)}` : `Open ${duration(r.windowLeft)}`}</Tag>}
                          {!r.manual && <Tag>{r.replyCount} replies</Tag>}
                          {b && <Tag>{pct(b.reach)} new to you</Tag>}
                          {r.topics.map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {capped && rooms.length >= viewer.limits.roomsPerDay && (
            <p className="mt-4 text-[13px] text-muted">
              Seedling shows your top {viewer.limits.roomsPerDay} rooms.{" "}
              <Link href="/app/settings/billing" className="text-ink underline underline-offset-2">
                Upgrade for all of them
              </Link>
              .
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <div>
            <h2 className="label !text-ink">Add a conversation</h2>
            <p className="mt-1 text-[13px] text-muted">Found a thread yourself, or on LinkedIn? Paste it here to check your reply and log it.</p>
            <div className="mt-3">{accounts.length ? <AddRoom accounts={accounts.map((a) => ({ id: a.id, label: `${a.handle} · ${PLATFORM_LABEL[a.platform]}` }))} /> : <ButtonLink href="/app/settings/accounts" size="sm">Connect an account</ButtonLink>}</div>
          </div>
          <div className="border-t border-line pt-4 text-[13px] text-muted">
            <p className="label mb-2">How leverage works</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-ink">Fit 38%</dt>
              <dd>Match with your topics and weights</dd>
              <dt className="text-ink">Early 24%</dt>
              <dd>Fresh post, room ahead of you</dd>
              <dt className="text-ink">Reach 22%</dt>
              <dd>Readers who don&apos;t know you yet</dd>
              <dt className="text-ink">Rapport 16%</dt>
              <dd>Chance the author notices</dd>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`rounded-sm border px-2 py-1 text-[12px] ${active ? "border-ink bg-ink text-inverse" : "border-line-strong hover:border-ink"}`}>
      {children}
    </Link>
  );
}
