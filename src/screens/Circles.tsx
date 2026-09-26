import { useState } from "react";
import type { Workspace } from "../App";
import { Avatar } from "../components/icons";
import { formatK } from "../components/ReachMap";
import { ago } from "../lib/format";
import { daysSinceContact, growthRate, reciprocity, warmth } from "../lib/scoring";
import type { Tendril } from "../lib/store";
import { PLATFORM_LABEL, type Circle, type Person } from "../lib/types";

const CIRCLES: { id: Circle; label: string; blurb: string }[] = [
  { id: "anchor", label: "Anchors", blurb: "Bigger accounts who've noticed you" },
  { id: "peer", label: "Peers", blurb: "Your size, your topics. Grow together" },
  { id: "rising", label: "Rising", blurb: "Small now, climbing fast. Meet them early" },
  { id: "fan", label: "Regulars", blurb: "People who show up for you" },
];

const MOVES: Record<Circle, string> = {
  anchor: "Reply with substance to their next post. Don't pitch.",
  peer: "Propose a swap: you answer a question in their thread, they answer one in yours.",
  rising: "Reply to their launch or milestone. Early support is remembered.",
  fan: "Thank them by name and ask what they're working on.",
};

export function Circles({ ws, tendril, notify }: { ws: Workspace; tendril: Tendril; notify: (m: string) => void }) {
  const [filter, setFilter] = useState<Circle | "all">("all");
  const shown = ws.people.filter((p) => filter === "all" || p.circle === filter).sort((a, b) => warmth(b) - warmth(a));
  const greeted = tendril.state.greeted;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Circles</span>
          <h1>The people who move your numbers</h1>
          <p>
            Tendril remembers every reply, mention and DM so you don't have to. Warmth fades with a three-week half-life, and the ledger shows who has been
            showing up for whom.
          </p>
        </div>
      </header>

      <section aria-labelledby="nudge-h">
        <h2 id="nudge-h" style={{ fontSize: 20, marginBottom: 12 }}>
          Worth a hello this week
        </h2>
        <div className="nudges">
          {ws.nudges.slice(0, 4).map((n) => {
            const done = greeted.includes(n.person.id);
            return (
              <div key={n.person.id} className="panel nudge">
                <div className="who">
                  <Avatar name={n.person.name} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650 }}>{n.person.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {CIRCLES.find((c) => c.id === n.person.circle)?.label} · {PLATFORM_LABEL[n.person.platform]}
                    </div>
                  </div>
                </div>
                <p className="reason">{n.reason}.</p>
                <p style={{ fontSize: 13.5 }}>
                  <b>Try:</b> {MOVES[n.person.circle]}
                </p>
                <button
                  type="button"
                  className={`btn small ${done ? "" : "primary"}`}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    tendril.toggle("greeted", n.person.id);
                    if (!done && !tendril.state.done.includes(`person:${n.person.id}`)) tendril.toggle("done", `person:${n.person.id}`);
                    notify(done ? "Unmarked" : `Logged your hello to ${n.person.name.split(" ")[0]}`);
                  }}
                >
                  {done ? "Done. Undo?" : "I reached out"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="filters" role="group" aria-label="Filter by circle">
        <button type="button" className="chip chip-toggle" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Everyone · {ws.people.length}
        </button>
        {CIRCLES.map((c) => (
          <button key={c.id} type="button" className="chip chip-toggle" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)} title={c.blurb}>
            {c.label} · {ws.people.filter((p) => p.circle === c.id).length}
          </button>
        ))}
      </div>
      {filter !== "all" && (
        <p className="muted" style={{ marginBottom: 14 }}>
          {CIRCLES.find((c) => c.id === filter)?.blurb}.
        </p>
      )}

      <div className="people">
        {shown.map((p) => (
          <PersonCard key={p.id} p={p} />
        ))}
      </div>
    </>
  );
}

function PersonCard({ p }: { p: Person }) {
  const w = warmth(p);
  const owed = reciprocity(p);
  const growth = growthRate(p);
  const warmthLabel = w >= 60 ? "Warm" : w >= 30 ? "Friendly" : w > 0 ? "Cooling" : "Not yet met";
  const ledger = [...p.interactions].sort((a, b) => b.daysAgo - a.daysAgo);
  return (
    <article className="panel person">
      <div className="person-head">
        <Avatar name={p.name} />
        <div className="grow">
          <div className="name">{p.name}</div>
          <div className="handle">
            @{p.handle} · {PLATFORM_LABEL[p.platform]}
          </div>
        </div>
        <span className="chip">{CIRCLES.find((c) => c.id === p.circle)?.label}</span>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{p.context}</p>
      <div className="warmth">
        <div className="kv">
          <span>Warmth</span>
          <span>
            <b>{warmthLabel}</b> <span className="mono muted">{w}</span>
          </span>
        </div>
        <div className="warmth-bar" role="meter" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100} aria-label={`Warmth ${w}`}>
          <span style={{ width: `${Math.max(2, w)}%` }} />
        </div>
      </div>
      <div className="kv">
        <span>Ledger</span>
        <span className="ledger" aria-label={`${p.interactions.filter((i) => i.inbound).length} times they showed up, ${p.interactions.filter((i) => !i.inbound).length} times you did`}>
          {ledger.length === 0 && <span className="muted">No history</span>}
          {ledger.map((i, k) => (
            <i key={k} className={i.inbound ? "in" : "out"} title={`${i.inbound ? "They" : "You"}: ${i.kind.replace(/-/g, " ")}, ${ago(i.daysAgo)}`} />
          ))}
        </span>
      </div>
      <div className="kv">
        <span>Balance</span>
        <span>{owed > 0 ? `You owe ${owed}` : owed < 0 ? `They owe ${-owed}` : "Even"}</span>
      </div>
      <div className="kv">
        <span>Last contact</span>
        <span>{ago(daysSinceContact(p))}</span>
      </div>
      <div className="kv">
        <span>Followers</span>
        <span className="mono">
          {formatK(p.followers)}{" "}
          <span style={{ color: growth > 0.3 ? "var(--good)" : "var(--muted)" }}>
            {growth >= 0 ? "+" : ""}
            {Math.round(growth * 100)}% / 90d
          </span>
        </span>
      </div>
    </article>
  );
}
