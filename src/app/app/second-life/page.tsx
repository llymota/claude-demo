import { Locked } from "@/components/locked";
import { Empty, PageHeader, Tag } from "@/components/ui";
import { pct } from "@/lib/format";
import { providerFor } from "@/lib/providers";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { accountsFor, secondLife } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { Resurface } from "./resurface";

export const metadata = { title: "Second Life" };

export default async function SecondLifePage() {
  const viewer = await requireUser();
  const intro = "Most of your followers arrived after your best work went out. These are the posts they never saw, ranked by how much of your audience missed them and how well they did the first time.";
  if (!viewer.limits.secondLife) return <Locked label="Second Life" title="Your best work, for people who missed it">{intro}</Locked>;

  const accounts = await accountsFor(viewer.user.id);
  const posts = await secondLife(accounts, viewer.workspace.topics);
  const candidates = posts.filter((p) => p.score > 0).slice(0, 25);
  const retired = posts.filter((p) => p.dated).slice(0, 10);
  const shortHistory = posts.length > 0 && posts[0].historyDays < 14;

  return (
    <>
      <PageHeader label="Second Life" title="Your best work, for people who missed it">
        {intro}
      </PageHeader>

      {shortHistory && (
        <p className="mt-6 border-l-2 border-ink pl-3 text-[13px] text-ink-2">
          Tendril has only a few days of follower history for you, so “never saw it” is conservative for now. It gets sharper every day.
        </p>
      )}

      <div className="mt-8">
        {candidates.length === 0 ? (
          <Empty title="Nothing to resurface yet">Posts need to be at least three weeks old, and not reshared in the last 60 days. Tendril imports your last 200 posts on each sync.</Empty>
        ) : (
          <ol className="border-t border-line">
            {candidates.map((p) => (
              <li key={p.id} id={p.id} className="grid gap-4 border-b border-line py-5 md:grid-cols-[minmax(0,1fr)_120px_90px]">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-[14px]">{p.text}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    <span>
                      {PLATFORM_LABEL[p.platform]} · {p.postedAt.toISOString().slice(0, 10)}
                    </span>
                    {p.topic && <Tag>{p.topic}</Tag>}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Original ↗
                    </a>
                  </p>
                  <div className="mt-3">
                    <Resurface postId={p.id} canPost={providerFor(p.platform).capabilities.post} platform={PLATFORM_LABEL[p.platform]} />
                  </div>
                </div>
                <div className="md:text-right">
                  <p className="label">Never saw it</p>
                  <p className="num mt-1 text-[22px] leading-none">{pct(p.unseen)}</p>
                </div>
                <div className="md:text-right">
                  <p className="label">Score</p>
                  <p className="num mt-1 text-[22px] leading-none">{p.score}</p>
                  <p className="num mt-1 text-[11px] text-muted">
                    {p.likes}♥ {p.replies}↩ {p.reposts}⟲
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {retired.length > 0 && (
        <details className="mt-8 text-[13px]">
          <summary className="cursor-pointer text-muted">Retired posts ({retired.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {retired.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-4 border-b border-line pb-2">
                <span className="text-ink-2">{p.text.slice(0, 160)}</span>
                <Resurface postId={p.id} canPost={false} platform="" retiredOnly />
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-8 text-[12px] text-muted">
        Score = 45% share of today&apos;s followers who followed after the post, 40% engagement against your own typical post (a save counts four likes, a reply three,
        a repost two), 15% topic weight.
      </p>
    </>
  );
}
