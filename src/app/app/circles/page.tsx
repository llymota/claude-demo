import { Locked } from "@/components/locked";
import { Empty, PageHeader, Section, Tag } from "@/components/ui";
import { ago, compact } from "@/lib/format";
import { accountsFor, circles } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { AskButton } from "../_components/assistant";
import { PersonActions } from "./person-actions";

export const metadata = { title: "Circles" };

const CIRCLES = [
  { id: "anchor", label: "Anchors", blurb: "Bigger accounts who've noticed you" },
  { id: "peer", label: "Peers", blurb: "Your size and topics" },
  { id: "rising", label: "Rising", blurb: "Growing fast. Meet them early" },
  { id: "fan", label: "Regulars", blurb: "People who keep showing up for you" },
] as const;

const MOVES = {
  anchor: "Reply with substance to their next post. Don't pitch.",
  peer: "Answer a question in their thread, and invite them into one of yours.",
  rising: "Reply to their next milestone. Early support is remembered.",
  fan: "Thank them by name and ask what they're working on.",
} as const;

export default async function CirclesPage(props: PageProps<"/app/circles">) {
  const viewer = await requireUser();
  const intro = "Tendril remembers every reply, mention and repost so you don't have to. Warmth fades with a three-week half-life. The ledger shows who has been showing up for whom.";
  if (!viewer.limits.circles) return <Locked label="Circles" title="The people who move your numbers">{intro}</Locked>;

  const accounts = await accountsFor(viewer.user.id);
  const { people, nudges } = await circles(accounts.map((a) => a.id));
  const q = await props.searchParams;
  const filter = CIRCLES.find((c) => c.id === q.circle)?.id;
  const shown = people.filter((p) => !filter || p.circle === filter);

  return (
    <>
      <PageHeader label="Circles" title="The people who move your numbers">
        {intro}
      </PageHeader>

      {people.length === 0 ? (
        <div className="pt-8">
          <Empty title="No one here yet">People appear as they reply to you, mention you, or you reply to them from Rooms.</Empty>
        </div>
      ) : (
        <>
          {nudges.length > 0 && (
            <Section title="Worth a hello this week" meta={`${nudges.length} ${nudges.length === 1 ? "person" : "people"}`}>
              <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
                {nudges.slice(0, 4).map((n) => (
                  <div key={n.personId} className="flex flex-col gap-2 bg-bg p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{n.person.name}</span>
                      <Tag>{CIRCLES.find((c) => c.id === n.person.circle)?.label}</Tag>
                    </div>
                    <p className="text-[13px] text-ink-2">{n.reason}.</p>
                    {n.person.aiBrief ? <p className="text-[13px] text-muted">{n.person.aiBrief}</p> : <p className="text-[13px] text-muted">{MOVES[n.person.circle]}</p>}
                    <AskButton question={`Help me reconnect with ${n.person.name}. What should I say?`} className="self-start text-[12px] underline underline-offset-2">
                      Ask what to say
                    </AskButton>
                    <PersonActions personId={n.personId} circle={n.person.circle} note={n.person.note ?? ""} pinned={n.person.pinnedCircle} compact />
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Everyone"
            meta={
              <span className="flex flex-wrap gap-1">
                <a href="/app/circles" className={!filter ? "font-medium text-ink" : ""}>All {people.length}</a>
                {CIRCLES.map((c) => (
                  <a key={c.id} href={`/app/circles?circle=${c.id}`} className={`ml-3 ${filter === c.id ? "font-medium text-ink" : ""}`}>
                    {c.label} {people.filter((p) => p.circle === c.id).length}
                  </a>
                ))}
              </span>
            }
          >
            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {["Person", "Circle", "Warmth", "Ledger", "Last contact", "Followers", ""].map((h, i) => (
                      <th key={i} className={`label px-4 py-2.5 font-normal ${h === "Followers" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} id={p.id} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-muted">@{p.handle}</p>
                        {p.note && <p className="mt-1 max-w-xs text-ink-2">{p.note}</p>}
                        {p.aiBrief && <p className="mt-1 max-w-xs text-[12px] text-muted">{p.aiBrief}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {CIRCLES.find((c) => c.id === p.circle)?.label}
                        {p.pinnedCircle && <span className="text-muted"> · set by you</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-subtle">
                            <div className="h-full bg-ink" style={{ width: `${p.warmth}%` }} />
                          </div>
                          <span className="num text-muted">{p.warmth}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Ledger items={p.interactions.filter((i) => i.kind !== "like").slice(0, 12)} />
                        <p className="mt-1 text-muted">{p.balance > 0 ? `You owe ${p.balance}` : p.balance < 0 ? `They owe ${-p.balance}` : "Even"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{ago(p.lastContactDays)}</td>
                      <td className="num px-4 py-3 text-right">
                        {compact(p.followers)}
                        {p.growth > 0.05 && <span className="block text-muted">+{Math.round(p.growth * 100)}%</span>}
                      </td>
                      <td className="px-4 py-3">
                        <PersonActions personId={p.id} circle={p.circle} note={p.note ?? ""} pinned={p.pinnedCircle} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-muted">Ledger: filled squares are times they showed up for you, outlined squares are times you showed up for them. Newest first.</p>
          </Section>
        </>
      )}
    </>
  );
}

function Ledger({ items }: { items: { inbound: boolean; kind: string; daysAgo: number }[] }) {
  if (items.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-[3px]" aria-label={`${items.filter((i) => i.inbound).length} from them, ${items.filter((i) => !i.inbound).length} from you`}>
      {items.map((i, k) => (
        <span key={k} title={`${i.inbound ? "They" : "You"}: ${i.kind.replace(/-/g, " ")}, ${ago(i.daysAgo)}`} className={`h-2.5 w-2.5 border border-ink ${i.inbound ? "bg-ink" : ""}`} />
      ))}
    </span>
  );
}
