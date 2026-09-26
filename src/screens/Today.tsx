import type { Workspace } from "../App";
import { ReachMap } from "../components/ReachMap";
import { Icon } from "../components/icons";
import { clip, minutes, pct } from "../lib/format";
import { auditProfile, resurfaceScore, unseenShare } from "../lib/scoring";
import type { Tendril } from "../lib/store";
import { PLATFORM_LABEL, type Circle } from "../lib/types";

const CIRCLE_LABEL: Record<Circle, string> = { anchor: "Anchor", peer: "Peer", rising: "Rising", fan: "Regular" };

interface Props {
  ws: Workspace;
  tendril: Tendril;
  openRoom: (id: string) => void;
  notify: (msg: string) => void;
}

interface Task {
  id: string;
  kind: string;
  title: string;
  meta: (string | { chip: string; tone: string })[];
  minutes: number;
  action: { label: string; run: () => void };
}

export function Today({ ws, tendril, openRoom, notify }: Props) {
  const { state, toggle } = tendril;
  const openRooms = ws.rooms.filter((r) => !state.replied.includes(r.conversation.id));

  const tasks: Task[] = [
    ...ws.rooms.slice(0, 3).map(
      (r): Task => ({
        id: `room:${r.conversation.id}`,
        kind: "Join a room",
        title: `Reply to ${r.conversation.author}: “${clip(r.conversation.text, 70)}”`,
        meta: [
          { chip: `Leverage ${r.leverage.score}`, tone: r.leverage.score >= 75 ? "pollen" : "moss" },
          { chip: `Window ${minutes(r.leverage.windowMinutes)}`, tone: r.leverage.windowMinutes < 30 ? "warn" : "" },
          `${PLATFORM_LABEL[r.conversation.platform]} · ${pct(1 - r.conversation.audienceOverlap)} new to you`,
        ],
        minutes: 3,
        action: { label: "Write reply", run: () => openRoom(r.conversation.id) },
      }),
    ),
    ...ws.nudges.slice(0, 2).map(
      (n): Task => ({
        id: `person:${n.person.id}`,
        kind: "Tend a relationship",
        title: `Check in with ${n.person.name}`,
        meta: [{ chip: CIRCLE_LABEL[n.person.circle], tone: "moss" }, n.reason],
        minutes: 2,
        action: { label: "See context", run: () => (window.location.hash = "circles") },
      }),
    ),
    ...[...ws.archive]
      .sort((a, b) => resurfaceScore(b, ws.profile) - resurfaceScore(a, ws.profile))
      .slice(0, 1)
      .map(
        (a): Task => ({
          id: `archive:${a.id}`,
          kind: "Second Life",
          title: `Resurface “${clip(a.text, 64)}”`,
          meta: [{ chip: `${pct(unseenShare(a, ws.profile))} never saw it`, tone: "pollen" }, "Reshare with a new first line"],
          minutes: 2,
          action: { label: "Open", run: () => (window.location.hash = "second-life") },
        }),
      ),
    ...auditProfile(ws.profile)
      .filter((c) => !c.ok)
      .slice(0, 1)
      .map(
        (c): Task => ({
          id: `store:${c.id}`,
          kind: "Storefront",
          title: `Fix your profile: ${c.label.toLowerCase()}`,
          meta: [{ chip: "Converts visits", tone: "moss" }, clip(c.detail, 80)],
          minutes: 3,
          action: { label: "Fix it", run: () => (window.location.hash = "storefront") },
        }),
      ),
  ];

  const done = tasks.filter((t) => state.done.includes(t.id)).length;
  const totalMin = tasks.reduce((n, t) => n + t.minutes, 0);
  const lastWeek = ws.weeklyFollows[ws.weeklyFollows.length - 1];
  const weekTotal = lastWeek.replies + lastWeek.relationships + lastWeek.resurfaced + lastWeek.profile;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Friday, 26 September</span>
          <h1>Good morning, Priya.</h1>
          <p>
            {openRooms.length} rooms are open where people haven't met you yet. Today's round takes about {totalMin} minutes and needs zero new posts.
          </p>
        </div>
      </header>

      <div className="stack" style={{ gap: 20 }}>
        <section className="thesis" aria-label="This week">
          <div>
            <span className="eyebrow">Posts published this week</span>
            <span className="big zero">0</span>
            <span className="muted" style={{ fontSize: 13 }}>
              That's the point.
            </span>
          </div>
          <div>
            <span className="eyebrow">New followers this week</span>
            <span className="big">+{weekTotal}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {lastWeek.replies} came from replies in rooms
            </span>
          </div>
          <div>
            <span className="eyebrow">Profile visits → follows</span>
            <span className="big">{pct(ws.profile.followsFromVisits30d / ws.profile.profileVisits30d)}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Last 30 days. Healthy is 15%+
            </span>
          </div>
        </section>

        <div className="today-grid">
          <section className="panel round" aria-labelledby="round-h">
            <div className="round-head">
              <div>
                <span className="eyebrow">Today's round</span>
                <h2 id="round-h">
                  {done === tasks.length ? "Round complete. Go live your life." : `${tasks.length - done} things, about ${totalMin} minutes`}
                </h2>
              </div>
              <span className="chip moss num">
                {done}/{tasks.length} done
              </span>
            </div>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            {tasks.map((t) => {
              const isDone = state.done.includes(t.id);
              return (
                <div key={t.id} className={`task ${isDone ? "done" : ""}`}>
                  <button
                    type="button"
                    className="check"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`Mark "${t.title}" done`}
                    onClick={() => {
                      toggle("done", t.id);
                      if (!isDone) notify(done + 1 === tasks.length ? "Round complete" : "Nice. One less thing.");
                    }}
                  >
                    {isDone && <Icon.check />}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <span className="eyebrow">
                      {t.kind} · {t.minutes} min
                    </span>
                    <div className="task-title">{t.title}</div>
                    <div className="task-meta">
                      {t.meta.map((m, i) =>
                        typeof m === "string" ? (
                          <span key={i}>{m}</span>
                        ) : (
                          <span key={i} className={`chip ${m.tone}`}>
                            {m.chip}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                  <button type="button" className="btn small" onClick={t.action.run}>
                    {t.action.label}
                  </button>
                </div>
              );
            })}
          </section>

          <section className="panel map-panel" aria-labelledby="map-h">
            <div>
              <span className="eyebrow">Reach map</span>
              <h2 id="map-h" style={{ fontSize: 20 }}>
                Where your next followers are talking
              </h2>
            </div>
            <ReachMap
              you={{ followers: ws.profile.followers, name: ws.profile.name }}
              rooms={ws.rooms.map((r) => ({ conversation: r.conversation, score: r.leverage.score }))}
              replied={state.replied}
            />
            <p className="muted" style={{ fontSize: 13 }}>
              You sit in the middle. The further out a room is, the fewer of its readers already know you. Tendrils mark the three rooms worth your time today.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
