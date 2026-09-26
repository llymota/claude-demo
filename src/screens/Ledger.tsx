import type { Workspace } from "../App";
import { FollowsChart, SOURCES } from "../components/FollowsChart";

export function Ledger({ ws }: { ws: Workspace }) {
  const data = ws.weeklyFollows;
  const sum = (key: (typeof SOURCES)[number]["key"]) => data.reduce((n, d) => n + d[key], 0);
  const total = SOURCES.reduce((n, s) => n + sum(s.key), 0);
  const first4 = data.slice(0, 4).reduce((n, d) => n + d.replies + d.relationships + d.resurfaced + d.profile, 0);
  const last4 = data.slice(-4).reduce((n, d) => n + d.replies + d.relationships + d.resurfaced + d.profile, 0);
  const repliesLogged = 214;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Ledger</span>
          <h1>What actually earned your followers</h1>
          <p>
            Tendril matches each new follower to the last thing they saw from you: a reply in someone's thread, a resurfaced post, a relationship, or your profile.
            No guessing from vanity metrics.
          </p>
        </div>
      </header>

      <div className="stack" style={{ gap: 20 }}>
        <section className="panel chart-panel" aria-labelledby="chart-h">
          <div>
            <span className="eyebrow">Last 12 weeks</span>
            <h2 id="chart-h" style={{ fontSize: 20 }}>
              New followers per week, by what earned them
            </h2>
          </div>
          <FollowsChart data={data} />
        </section>

        <div className="insights">
          <div className="panel insight">
            <span className="eyebrow">12-week total</span>
            <span className="big">+{total}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              With 3 original posts in the same period
            </span>
          </div>
          <div className="panel insight">
            <span className="eyebrow">Momentum</span>
            <span className="big">{(last4 / first4).toFixed(1)}×</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Last 4 weeks vs first 4 weeks
            </span>
          </div>
          <div className="panel insight">
            <span className="eyebrow">Follows per reply</span>
            <span className="big">{(sum("replies") / repliesLogged).toFixed(1)}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {repliesLogged} replies logged. A Magnetic reply earns 4× a Polite one
            </span>
          </div>
          <div className="panel insight">
            <span className="eyebrow">Biggest lever</span>
            <span className="big">{Math.round((sum("replies") / total) * 100)}%</span>
            <span className="muted" style={{ fontSize: 13 }}>
              of follows came from replying in other people's rooms
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
