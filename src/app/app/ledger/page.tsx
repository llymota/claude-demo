import { Locked } from "@/components/locked";
import { Empty, PageHeader, Section, Stat } from "@/components/ui";
import { accountsFor, ledger, replyStats } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { FollowsChart, SOURCES } from "./chart";

export const metadata = { title: "Ledger" };

export default async function LedgerPage() {
  const viewer = await requireUser();
  const intro =
    "Each new follower is credited to the last thing of yours they touched: a reply you posted, a post you resurfaced, a relationship, or your profile. Platforms that don't list followers report counts only, shown as unattributed.";
  if (!viewer.limits.ledger) return <Locked label="Ledger" title="What actually earned your followers">{intro}</Locked>;

  const accounts = await accountsFor(viewer.user.id);
  const { weekly } = await ledger(accounts.map((a) => a.id));
  const stats = await replyStats(viewer.user.id);
  const sum = (k: (typeof SOURCES)[number]["key"]) => weekly.reduce((n, w) => n + w[k], 0);
  const total = SOURCES.reduce((n, s) => n + sum(s.key), 0);
  const attributed = total - sum("unattributed");

  return (
    <>
      <PageHeader label="Ledger" title="What actually earned your followers">
        {intro}
      </PageHeader>
      {weekly.length === 0 ? (
        <div className="pt-8">
          <Empty title="No follows recorded yet">The Ledger starts counting from your first sync. Existing followers are the baseline and are never credited.</Empty>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 border border-line lg:grid-cols-4 [&>*]:border-line [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(even)]:border-l lg:[&>*+*]:border-l">
            <Stat label="New followers" value={`+${total}`} note={`Last ${weekly.length} week${weekly.length === 1 ? "" : "s"}`} />
            <Stat label="From replies" value={attributed ? `${Math.round((sum("replies") / attributed) * 100)}%` : "—"} note="Of attributed follows" />
            <Stat label="Replies logged" value={stats.n} note={stats.n ? `Average score ${stats.avg}` : "Reply from Rooms to start"} />
            <Stat label="Follows per reply" value={stats.n ? (sum("replies") / stats.n).toFixed(1) : "—"} note="Credited to a reply" />
          </div>
          <Section title="Follows per week, by what earned them">
            <FollowsChart weekly={weekly} />
          </Section>
        </>
      )}
    </>
  );
}
