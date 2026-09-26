import type { Workspace } from "../App";
import { pct } from "../lib/format";
import { archiveMatches, engagementRate, resurfaceScore, unseenShare } from "../lib/scoring";
import { PLATFORM_LABEL, type ArchivePost } from "../lib/types";

interface Props {
  ws: Workspace;
  openRoom: (id: string) => void;
  notify: (m: string) => void;
}

function Ring({ value }: { value: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--pollen)" strokeWidth="4" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 13 13)" strokeLinecap="round" />
    </svg>
  );
}

function move(post: ArchivePost, score: number, matches: number) {
  if (post.dated) return { label: "Retire", detail: "Mentions a moment that's passed.", tone: "" };
  if (matches > 0) return { label: `Reply material for ${matches} live room${matches > 1 ? "s" : ""}`, detail: "Bring its core point into a conversation instead of reposting.", tone: "pollen" };
  if (score >= 60) return { label: "Reshare with a new first line", detail: "Same insight, a hook written for who follows you now.", tone: "moss" };
  return { label: "Keep in the vault", detail: "Not enough people missed it yet.", tone: "" };
}

export function SecondLife({ ws, openRoom, notify }: Props) {
  const rooms = ws.rooms.map((r) => r.conversation);
  const rows = [...ws.archive]
    .map((a) => ({ a, score: resurfaceScore(a, ws.profile), unseen: unseenShare(a, ws.profile), matches: archiveMatches(a, rooms) }))
    .sort((x, y) => y.score - x.score);
  const avgUnseen = rows.filter((r) => !r.a.dated).reduce((n, r) => n + r.unseen, 0) / rows.filter((r) => !r.a.dated).length;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Second Life</span>
          <h1>Your best work, for people who missed it</h1>
          <p>
            You've grown from {ws.profile.followerHistory[0].followers.toLocaleString()} to {ws.profile.followers.toLocaleString()} followers in a year. On average{" "}
            <b>{pct(avgUnseen)}</b> of them have never seen your strongest posts. You don't need new content. You need your old content to meet your new audience.
          </p>
        </div>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Post</th>
              <th className="n">Never saw it</th>
              <th className="n">Engagement</th>
              <th className="n">Score</th>
              <th>Best move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, score, unseen, matches }) => {
              const m = move(a, score, matches.length);
              return (
                <tr key={a.id} style={a.dated ? { opacity: 0.6 } : undefined}>
                  <td>
                    <div className="post-text">{a.text}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                      {PLATFORM_LABEL[a.platform]} · {ws.profile.followerHistory[a.postedMonth].month} · {a.topic}
                    </div>
                  </td>
                  <td className="n">
                    <span className="unseen">
                      {pct(unseen)} <Ring value={unseen} />
                    </span>
                  </td>
                  <td className="n">{(engagementRate(a) * 100).toFixed(1)}%</td>
                  <td className="n">
                    <b>{score}</b>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <div className="stack" style={{ gap: 6, alignItems: "flex-start" }}>
                      <span className={`chip ${m.tone}`}>{m.label}</span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {m.detail}
                      </span>
                      {matches.length > 0 && !a.dated ? (
                        <button type="button" className="btn small" onClick={() => openRoom(matches[0].id)}>
                          Open {matches[0].author.split(" ")[0]}'s room
                        </button>
                      ) : score >= 60 ? (
                        <button type="button" className="btn small" onClick={() => notify("Added to next week's Second Life queue")}>
                          Queue reshare
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
        Engagement weights a save as four likes and a reply as three, because both predict that a post still has something to say. “Never saw it” is the share of
        today's followers who followed after the post went out.
      </p>
    </>
  );
}
