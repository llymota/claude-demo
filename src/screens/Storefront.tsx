import type { Workspace } from "../App";
import { Avatar } from "../components/icons";
import { clip, pct } from "../lib/format";
import { auditProfile, profileConversion, resurfaceScore } from "../lib/scoring";
import type { Tendril } from "../lib/store";

const BENCHMARK = 0.15;

export function Storefront({ ws, tendril }: { ws: Workspace; tendril: Tendril }) {
  const bio = tendril.state.bioDraft ?? ws.profile.bio;
  const edited = { ...ws.profile, bio };
  const checks = auditProfile(edited);
  const passing = checks.filter((c) => c.ok).length;
  const conv = profileConversion(ws.profile);
  const missed = Math.max(0, Math.round(ws.profile.profileVisits30d * BENCHMARK - ws.profile.followsFromVisits30d));
  const bestPin = [...ws.archive].filter((a) => !a.dated).sort((a, b) => resurfaceScore(b, ws.profile) - resurfaceScore(a, ws.profile))[0];

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Storefront</span>
          <h1>Turn the visits you earn into follows</h1>
          <p>Every good reply sends people to your profile. Most of them leave in a few seconds. This is the cheapest growth you will ever find.</p>
        </div>
      </header>

      <div className="store-grid">
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel funnel" aria-labelledby="funnel-h">
            <span className="eyebrow" id="funnel-h">
              Last 30 days
            </span>
            <div className="row wrap" style={{ gap: 20, alignItems: "flex-end" }}>
              <div>
                <div className="figure num">{pct(conv)}</div>
                <div className="muted">of profile visitors followed you</div>
              </div>
              <div className="stack" style={{ gap: 4, fontSize: 14 }}>
                <span>
                  <b className="num">{ws.profile.profileVisits30d.toLocaleString()}</b> <span className="muted">profile visits</span>
                </span>
                <span>
                  <b className="num">{ws.profile.followsFromVisits30d}</b> <span className="muted">follows from them</span>
                </span>
              </div>
            </div>
            <div className="bars" style={{ gridTemplateColumns: "auto minmax(0,1fr) 40px" }}>
              <span>You</span>
              <span className="track">
                <span style={{ width: pct(conv / 0.25) }} />
              </span>
              <span className="v">{pct(conv)}</span>
              <span>Healthy</span>
              <span className="track">
                <span style={{ width: pct(BENCHMARK / 0.25), background: "var(--pollen)" }} />
              </span>
              <span className="v">{pct(BENCHMARK)}</span>
            </div>
            <p style={{ fontSize: 14 }}>
              At a healthy rate you'd have gained about <b>{missed} more followers</b> this month from the same visits, without a single extra reply.
            </p>
          </section>

          <section className="panel funnel" aria-labelledby="checks-h">
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <h2 id="checks-h" style={{ fontSize: 20 }}>
                First-impression check
              </h2>
              <span className={`chip ${passing === checks.length ? "good" : "warn"}`}>
                {passing}/{checks.length} passing
              </span>
            </div>
            <ul className="checks">
              {checks.map((c) => (
                <li key={c.id}>
                  <span className={`tick ${c.ok ? "ok" : "no"}`} aria-label={c.ok ? "Passing" : "Needs work"}>
                    {c.ok ? "✓" : "!"}
                  </span>
                  <div>
                    <b>{c.label}</b>
                    {!c.ok && <p>{c.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel profile-card" aria-labelledby="bio-h">
          <span className="eyebrow">Your profile, as a visitor sees it</span>
          <div className="row" style={{ gap: 12 }}>
            <Avatar name={ws.profile.name} size="lg" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{ws.profile.name}</div>
              <div className="muted">
                @{ws.profile.handle} · {ws.profile.followers.toLocaleString()} followers
              </div>
            </div>
          </div>
          <label htmlFor="bio" className="stack" style={{ gap: 6 }}>
            <span className="eyebrow" id="bio-h">
              Bio · edit to re-run the check
            </span>
            <textarea id="bio" value={bio} maxLength={160} onChange={(e) => tendril.setBio(e.target.value)} />
          </label>
          <div className="row wrap" style={{ justifyContent: "space-between", gap: 8 }}>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {bio.length}/160
            </span>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => tendril.setBio("Helping 1,200 freelancers stop dreading tax season. Building @Ledgerly. Writing about freelance finance & pricing.")}
            >
              Show an example that passes
            </button>
          </div>

          <div className="stack" style={{ gap: 8, marginTop: 6 }}>
            <span className="eyebrow">Pinned post</span>
            <div className="quote" style={{ fontSize: 14 }}>
              {ws.profile.pinned.text}
              <div className="muted" style={{ fontSize: 12.5 }}>
                Pinned {ws.profile.pinned.postedMonthsAgo} months ago · {ws.profile.pinned.topic}
              </div>
            </div>
            {bestPin && (
              <div className="ammo">
                <span className="eyebrow">Pin this instead</span>
                <span>“{clip(bestPin.text, 140)}”</span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Your highest-scoring post on {bestPin.topic}, the topic that brings most visitors in.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
