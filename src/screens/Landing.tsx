import { useState } from "react";
import { ReplyMeter } from "../components/ReplyCoach";
import { Avatar, Icon, Logo } from "../components/icons";

const SAMPLE_POST =
  "Freelancers: what's the one money habit you wish you'd started in year one? Mine was separating a tax account. Took me 4 years.";

const PRESETS = [
  { label: "“Great post!”", text: "Great post! So true 🙌" },
  { label: "A self-plug", text: "I wrote about this exact problem, check out my newsletter at priya.io for the full breakdown" },
  {
    label: "A reply worth a follow",
    text: "Same, but the account alone didn't fix it. What worked: moving 30% the day each invoice clears, before I could see it. When we automated that in 2023, April went from panic to a non-event. Do you move it per invoice or monthly?",
  },
];

const PILLARS = [
  {
    icon: Icon.rooms,
    name: "Rooms",
    body: "A live radar of conversations where you'd be worth meeting. Ranked by fit, how early you are, how much of the room has never seen you, and how likely the author is to notice.",
    sample: "Dana Whitfield · 48k · 9 replies · window 46m · leverage 80",
  },
  {
    icon: Icon.circles,
    name: "Circles",
    body: "Relationship memory for the people who move your numbers. Warmth that fades if you disappear, a ledger of who showed up for whom, and a nudge before a connection goes cold.",
    sample: "Leah Fontaine showed up for you 3 more times than you did for her",
  },
  {
    icon: Icon.secondLife,
    name: "Second Life",
    body: "Most of your followers arrived after your best work went out. Tendril finds the posts they missed and tells you whether to reshare them or bring them into a live conversation.",
    sample: "30/30/40 rule · 77% of today's followers never saw it",
  },
  {
    icon: Icon.storefront,
    name: "Storefront",
    body: "Good replies send people to your profile. A first-impression check on your bio and pinned post makes sure the visit turns into a follow.",
    sample: "11% of visitors follow · healthy is 15% · 67 follows left on the table",
  },
];

const NEVERS = [
  ["Post for you", "No scheduling, no autopilot. You are the one in the room."],
  ["Write your replies", "Tendril checks your words. It never generates them."],
  ["Follow and unfollow", "No growth hacks that get accounts flagged."],
  ["Run engagement pods", "Fake engagement trains the algorithm to ignore you."],
  ["Read your DMs", "Circles uses public replies and what you choose to log."],
  ["Sell your graph", "Your relationships are yours. Export them any time."],
];

export function Landing() {
  const [reply, setReply] = useState(PRESETS[0].text);

  return (
    <div className="landing">
      <div className="l-wrap">
        <header className="l-nav">
          <a className="brand" href="#welcome">
            <Logo /> Tendril
          </a>
          <nav aria-label="Site">
            <a href="#welcome" onClick={(e) => (e.preventDefault(), document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }))}>
              How it works
            </a>
            <a href="#welcome" onClick={(e) => (e.preventDefault(), document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }))}>
              Pricing
            </a>
            <a className="btn primary small" href="#today">
              Open the demo
            </a>
          </nav>
        </header>

        <section className="hero">
          <div>
            <span className="eyebrow">Organic growth, without the content treadmill</span>
            <h1 style={{ marginTop: 14 }}>
              Your next thousand followers are in <em>other people's</em> replies.
            </h1>
            <p className="lede">
              Tendril finds the conversations where you'd be worth meeting, remembers the people who show up for you, and hands your best old posts to the followers
              who missed them. Fifteen minutes a day. No new posts required.
            </p>
            <div className="ctas">
              <a className="btn primary" href="#today">
                Open the demo workspace <Icon.arrow />
              </a>
              <a className="btn" href="#rooms">
                See today's rooms
              </a>
            </div>
            <p className="fine">Works with X, LinkedIn, Bluesky and Threads. Free for one account.</p>
          </div>

          <div className="panel demo-card" aria-labelledby="demo-h">
            <div>
              <span className="eyebrow">Try the reply check</span>
              <h2 id="demo-h" style={{ fontSize: 22, marginTop: 4 }}>
                Would this reply earn a follow?
              </h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Avatar name="Dana Whitfield" size="sm" />
              <div style={{ fontSize: 13 }}>
                <b>Dana Whitfield</b> <span className="muted">· 48.2k followers · 14m ago</span>
              </div>
            </div>
            <p className="quote">{SAMPLE_POST}</p>
            <div className="demo-presets" role="group" aria-label="Example replies">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip chip-toggle" aria-pressed={reply === p.text} onClick={() => setReply(p.text)}>
                  {p.label}
                </button>
              ))}
            </div>
            <label htmlFor="hero-reply" className="visually-hidden">
              Your reply
            </label>
            <textarea id="hero-reply" className="reply" style={{ minHeight: 96 }} value={reply} onChange={(e) => setReply(e.target.value)} />
            <ReplyMeter text={reply} />
          </div>
        </section>
      </div>

      <section className="l-section" id="how">
        <div className="l-wrap">
          <span className="eyebrow">The shift</span>
          <h2 style={{ marginTop: 10 }}>Growth comes from being in the right rooms, not from filling your own.</h2>
          <p className="intro">
            An account with 2,000 followers posting into its own feed reaches the same 2,000 people. One useful reply in a 50,000-person thread puts you in front of
            strangers who already care about your topic. Content tools help you make more. Tendril helps you show up where it counts.
          </p>
          <div className="shift">
            <div>
              <span className="eyebrow">Content tools optimise</span>
              <ul>
                <li>How often you post</li>
                <li>What time you post</li>
                <li>How many drafts an AI can generate</li>
                <li>Impressions on your own feed</li>
              </ul>
            </div>
            <div>
              <span className="eyebrow" style={{ color: "var(--moss)" }}>
                Tendril optimises
              </span>
              <ul>
                <li>Which conversations to join, while they are still early</li>
                <li>Which relationships are cooling, and who you owe a hello</li>
                <li>Which of your old posts your new followers never saw</li>
                <li>Whether a profile visit turns into a follow</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="l-wrap">
          <span className="eyebrow">The daily round</span>
          <h2 style={{ marginTop: 10 }}>Four tools, one fifteen-minute routine.</h2>
          <p className="intro">
            Each morning Tendril builds a short round: three rooms to join, two people to check in with, one post to resurface and one profile fix. Then the Ledger
            shows which of those actually earned followers.
          </p>
          <div className="pillars">
            {PILLARS.map((p) => (
              <article key={p.name} className="panel pillar">
                <span style={{ color: "var(--moss)" }}>
                  <p.icon />
                </span>
                <h3>{p.name}</h3>
                <p>{p.body}</p>
                <div className="sample">{p.sample}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="l-wrap">
          <span className="eyebrow">Principles</span>
          <h2 style={{ marginTop: 10 }}>What Tendril will never do.</h2>
          <p className="intro">People follow people. Anything that fakes the person gets you growth that doesn't last, and sometimes a banned account.</p>
          <ul className="nevers">
            {NEVERS.map(([b, s]) => (
              <li key={b}>
                <span className="x" aria-hidden="true">
                  ×
                </span>
                <div>
                  <b>{b}</b>
                  <span>{s}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="l-section" id="pricing">
        <div className="l-wrap">
          <span className="eyebrow">Pricing</span>
          <h2 style={{ marginTop: 10 }}>Pay for the round, not for posts.</h2>
          <div className="plans">
            <article className="panel plan">
              <span className="eyebrow">Seedling</span>
              <div className="price">
                $0 <small>forever</small>
              </div>
              <ul>
                <li>One platform</li>
                <li>Five rooms a day</li>
                <li>Reply check</li>
                <li>Storefront check</li>
              </ul>
              <a className="btn" href="#today">
                Start free
              </a>
            </article>
            <article className="panel plan featured">
              <span className="eyebrow" style={{ color: "var(--moss)" }}>
                Grower
              </span>
              <div className="price">
                $19 <small>per month</small>
              </div>
              <ul>
                <li>X, LinkedIn, Bluesky and Threads</li>
                <li>Unlimited rooms, alerts when a window opens</li>
                <li>Circles and Second Life</li>
                <li>Ledger attribution</li>
              </ul>
              <a className="btn primary" href="#today">
                Try the demo
              </a>
            </article>
            <article className="panel plan">
              <span className="eyebrow">Studio</span>
              <div className="price">
                $49 <small>per month</small>
              </div>
              <ul>
                <li>Up to three profiles, like founder plus company</li>
                <li>Shared Circles for a small team</li>
                <li>Weekly growth review</li>
                <li>Export your relationship graph</li>
              </ul>
              <a className="btn" href="#today">
                Try the demo
              </a>
            </article>
          </div>
        </div>
      </section>

      <div className="l-wrap">
        <footer className="l-foot">
          <span>Tendril is a product concept. The demo workspace uses invented people and numbers.</span>
          <a href="#today">Open the demo</a>
        </footer>
      </div>
    </div>
  );
}
