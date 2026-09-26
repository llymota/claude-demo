import { useEffect, useState } from "react";
import type { Workspace } from "../App";
import { ReplyCoach } from "../components/ReplyCoach";
import { Avatar, Icon } from "../components/icons";
import { formatK } from "../components/ReachMap";
import { minutes, pct } from "../lib/format";
import { archiveMatches, checkReply } from "../lib/scoring";
import type { Tendril } from "../lib/store";
import { PLATFORM_LABEL, type Platform } from "../lib/types";

interface Props {
  ws: Workspace;
  tendril: Tendril;
  focus: string | null;
  setFocus: (id: string) => void;
  notify: (msg: string) => void;
}

const PLATFORMS: ("all" | Platform)[] = ["all", "x", "linkedin", "bluesky", "threads"];

export function Rooms({ ws, tendril, focus, setFocus, notify }: Props) {
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const list = ws.rooms.filter((r) => platform === "all" || r.conversation.platform === platform);
  const selected = ws.rooms.find((r) => r.conversation.id === focus) ?? list[0];

  useEffect(() => {
    if (!focus && list[0]) setFocus(list[0].conversation.id);
  }, [focus, list, setFocus]);

  const c = selected?.conversation;
  const lev = selected?.leverage;
  const draft = c ? drafts[c.id] ?? "" : "";
  const replied = c ? tendril.state.replied.includes(c.id) : false;
  const ammo = c ? ws.archive.filter((a) => !a.dated && archiveMatches(a, [c]).length > 0).slice(0, 1)[0] : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Rooms</span>
          <h1>Conversations worth joining</h1>
          <p>
            Ranked by leverage: how well you can speak to it, how early you are, how much of the room has never seen you, and whether the author is likely to
            notice. Crowded threads drop off the list.
          </p>
        </div>
        <div className="filters" role="group" aria-label="Filter by platform" style={{ marginBottom: 0 }}>
          {PLATFORMS.map((p) => (
            <button key={p} type="button" className="chip chip-toggle" aria-pressed={platform === p} onClick={() => setPlatform(p)}>
              {p === "all" ? "All platforms" : PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      </header>

      <div className="rooms-layout">
        <div className="room-list">
          {list.length === 0 && <p className="muted">No open rooms on this platform right now. Tendril checks again every few minutes.</p>}
          {list.map(({ conversation: r, leverage: l }) => {
            const done = tendril.state.replied.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                className={`room ${done ? "replied" : ""}`}
                aria-pressed={selected?.conversation.id === r.id}
                onClick={() => setFocus(r.id)}
              >
                <span className={`score ${l.score >= 75 ? "hot" : ""}`}>
                  {l.score}
                  <small>lev</small>
                </span>
                <span className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <span className="room-who">
                    <strong>{r.author}</strong>
                    <span>
                      {PLATFORM_LABEL[r.platform]} · {formatK(r.authorFollowers)} followers · {r.ageMinutes}m ago
                    </span>
                  </span>
                  <span className="room-text">{r.text}</span>
                  <span className="room-foot">
                    {done ? (
                      <span className="chip good">Replied</span>
                    ) : (
                      <span className={`chip ${l.windowMinutes < 30 ? "warn" : ""}`}>
                        <Icon.clock /> {l.windowMinutes < 30 ? `Closing in ${minutes(l.windowMinutes)}` : `Open ${minutes(l.windowMinutes)}`}
                      </span>
                    )}
                    <span className="chip">{r.replies} replies</span>
                    <span className="chip">{pct(1 - r.audienceOverlap)} new to you</span>
                    {r.personId && <span className="chip moss">In your circles</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {c && lev && (
          <aside className="panel composer" aria-label="Reply workspace">
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={c.author} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650 }}>{c.author}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  @{c.authorHandle} · {PLATFORM_LABEL[c.platform]}
                </div>
              </div>
            </div>
            <p className="quote">{c.text}</p>

            <div className="bars" aria-label="Why this room ranks where it does">
              {[
                ["Fit", lev.fit, "You can speak to this"],
                ["Early", lev.early, "Room ahead of you"],
                ["New reach", lev.reach, "Readers who don't know you"],
                ["Rapport", lev.rapport, "Author likely to notice"],
              ].map(([k, v, title]) => (
                <div key={k as string} style={{ display: "contents" }} title={title as string}>
                  <span>{k as string}</span>
                  <span className="track">
                    <span style={{ width: pct(v as number) }} />
                  </span>
                  <span className="v">{Math.round((v as number) * 100)}</span>
                </div>
              ))}
            </div>

            {ammo && (
              <div className="ammo">
                <span className="eyebrow">You already wrote about this</span>
                <span>“{ammo.text}”</span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Borrow the core of it. {pct(1 - (ws.profile.followerHistory[ammo.postedMonth]?.followers ?? 0) / ws.profile.followers)} of your followers never
                  saw the original.
                </span>
              </div>
            )}

            <ReplyCoach key={c.id} id={`reply-${c.id}`} value={draft} onChange={(v) => setDrafts((d) => ({ ...d, [c.id]: v }))} />

            <div className="row wrap" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn primary"
                disabled={!draft.trim()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft);
                    notify(checkReply(draft).grade === "Invisible" ? "Copied. Consider one more pass first." : "Reply copied. Paste it in the thread.");
                  } catch {
                    const el = document.getElementById(`reply-${c.id}`) as HTMLTextAreaElement | null;
                    el?.select();
                    notify("Selected. Press copy to take it with you.");
                  }
                }}
              >
                Copy reply
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  tendril.toggle("replied", c.id);
                  if (!replied && !tendril.state.done.includes(`room:${c.id}`)) tendril.toggle("done", `room:${c.id}`);
                  notify(replied ? "Marked as not replied" : "Logged. Tendril will watch for follows from this room.");
                }}
              >
                {replied ? "Undo replied" : "Mark as replied"}
              </button>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
