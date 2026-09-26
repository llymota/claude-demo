import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { PLANS } from "@/lib/billing/plans";
import { ReplyDemo } from "./demo";

const TOOLS = [
  {
    n: "01",
    name: "Rooms",
    what: "Live conversations on your topics, ranked by how many people will see a reply from you in the next hour.",
    why: "A thoughtful reply in a busy thread reaches more new people than most original posts.",
  },
  {
    n: "02",
    name: "Circles",
    what: "The people who keep showing up for you, with warmth, reciprocity and who you've gone quiet on.",
    why: "Growth compounds through relationships. Tendril remembers so you don't have to.",
  },
  {
    n: "03",
    name: "Second Life",
    what: "Your best past posts that most of your current followers have never seen, and when to reshare them.",
    why: "If you doubled your audience this year, half of them missed everything before.",
  },
  {
    n: "04",
    name: "Storefront",
    what: "A plain audit of your bio and pinned post against the topics you want to be known for.",
    why: "Every reply sends people to your profile. It has three seconds to make the case.",
  },
  {
    n: "05",
    name: "Ledger",
    what: "Where your new followers actually came from: which replies, which people, which resurfaced posts.",
    why: "So you do more of what works and stop guessing.",
  },
];

const PLATFORMS = [
  { name: "Bluesky", rooms: true, circles: true, archive: true, ledger: "Per follower" },
  { name: "X", rooms: true, circles: true, archive: true, ledger: "Depends on API tier" },
  { name: "Threads", rooms: true, circles: true, archive: true, ledger: "Counts" },
  { name: "LinkedIn", rooms: false, circles: false, archive: false, ledger: "Counts" },
];

const FAQ = [
  { q: "Does Tendril post for me?", a: "Only when you press Post on a reply you wrote. There is no scheduling, no auto-replies and no automation of any kind." },
  { q: "Does it write replies with AI?", a: "No. Replies written by a model are easy to spot and do nothing for your reputation. Tendril checks your reply and tells you what would make it land." },
  { q: "What does it read?", a: "Your posts, replies, mentions and follower changes on the accounts you connect, plus public posts matching your topics. Tokens are encrypted at rest." },
  { q: "Can I leave?", a: "Yes. Cancel from Settings, export your data, or delete your account. Deleting removes everything immediately." },
];

function Check({ on }: { on: boolean }) {
  return <span className={on ? "" : "text-faint"}>{on ? "Yes" : "No"}</span>;
}

export default function Landing() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pt-20 pb-16 md:pt-28">
        <p className="label">For people who already post enough</p>
        <h1 className="mt-4 max-w-3xl text-[40px] leading-[1.05] font-semibold md:text-[56px]">Grow without posting more.</h1>
        <p className="mt-5 max-w-xl text-[17px] text-ink-2">
          Tendril finds the conversations worth joining, remembers the people who show up for you, and resurfaces the posts your new followers missed. Fifteen minutes a day.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/sign-up" className={buttonClass("primary", "lg")}>
            Start free
          </Link>
          <Link href="/pricing" className="text-[14px] underline underline-offset-4">
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-[13px] text-muted">Free plan, no card. Works with Bluesky, X, Threads and LinkedIn.</p>
      </section>

      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <h2 className="text-[22px] font-semibold">Five tools, one daily round</h2>
            <p className="max-w-xl text-ink-2">Each morning Tendril builds a short list: two or three rooms to reply in, a person to check in with, a post to reshare, one fix to your profile. Do it, tick it off, get on with your day.</p>
          </div>
          <ol className="mt-10 border-t border-ink">
            {TOOLS.map((t) => (
              <li key={t.n} className="grid gap-2 border-b border-line py-6 md:grid-cols-[60px_180px_minmax(0,1fr)_minmax(0,1fr)] md:gap-6">
                <span className="num text-[13px] text-muted">{t.n}</span>
                <h3 className="font-semibold">{t.name}</h3>
                <p>{t.what}</p>
                <p className="text-ink-2">{t.why}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-subtle">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="mb-8 grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <h2 className="text-[22px] font-semibold">Try the reply check</h2>
            <p className="max-w-xl text-ink-2">Most replies are invisible. The check looks for what makes people click through to your profile: a specific experience, a number, a real question.</p>
          </div>
          <div className="bg-bg">
            <ReplyDemo />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-[22px] font-semibold">What Tendril won&apos;t do</h2>
            <ul className="mt-5 flex flex-col gap-3 text-ink-2">
              <li>Write posts or replies for you.</li>
              <li>Schedule, automate, like, follow or unfollow on your behalf.</li>
              <li>Sell or share your data. Ever.</li>
              <li>Show you numbers the platforms don&apos;t actually provide.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-[22px] font-semibold">Platform support</h2>
            <table className="mt-5 w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th className="label py-2 font-normal">Platform</th>
                  <th className="label py-2 font-normal">Rooms</th>
                  <th className="label py-2 font-normal">Circles</th>
                  <th className="label py-2 font-normal">Archive</th>
                  <th className="label py-2 font-normal">Ledger</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORMS.map((p) => (
                  <tr key={p.name} className="border-b border-line">
                    <td className="py-2.5 font-medium">{p.name}</td>
                    <td className="py-2.5"><Check on={p.rooms} /></td>
                    <td className="py-2.5"><Check on={p.circles} /></td>
                    <td className="py-2.5"><Check on={p.archive} /></td>
                    <td className="py-2.5 text-ink-2">{p.ledger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-muted">LinkedIn doesn&apos;t let third-party apps read feeds. You can paste LinkedIn posts into Rooms to check your reply.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[22px] font-semibold">Pricing</h2>
            <Link href="/pricing" className="text-[13px] underline underline-offset-4">
              Compare plans
            </Link>
          </div>
          <div className="mt-6 grid gap-px border border-line bg-line md:grid-cols-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className="bg-bg p-5">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1">
                  <span className="num text-[24px]">${p.priceMonthly}</span>
                  <span className="text-[13px] text-muted"> / month</span>
                </p>
                <p className="mt-2 text-[13px] text-ink-2">{p.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-[240px_minmax(0,1fr)]">
          <h2 className="text-[22px] font-semibold">Questions</h2>
          <dl className="border-t border-line">
            {FAQ.map((f) => (
              <div key={f.q} className="grid gap-1 border-b border-line py-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
                <dt className="font-medium">{f.q}</dt>
                <dd className="text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-ink bg-ink text-inverse">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6 px-4 py-14">
          <p className="text-[24px] font-semibold">Your next thousand followers are already in someone else&apos;s replies.</p>
          <Link href="/sign-up" className="inline-flex h-11 items-center rounded-md border border-inverse bg-inverse px-5 text-[15px] font-medium text-ink hover:opacity-90">
            Start free
          </Link>
        </div>
      </section>
    </>
  );
}
