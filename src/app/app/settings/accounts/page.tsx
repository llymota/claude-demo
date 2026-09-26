import { Notice, Tag } from "@/components/ui";
import { relative } from "@/lib/format";
import { enabledPlatforms, providers } from "@/lib/providers";
import { PLATFORM_LABEL, type Platform } from "@/lib/providers/types";
import { accountsFor } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { AccountActions } from "./account-actions";

export const metadata = { title: "Accounts" };

const CAPS: { key: keyof (typeof providers)["x"]["capabilities"]; label: string }[] = [
  { key: "rooms", label: "Rooms" },
  { key: "post", label: "Post replies" },
  { key: "archive", label: "Second Life" },
  { key: "interactions", label: "Circles" },
  { key: "followerList", label: "Per-follower Ledger" },
];

const NOTES: Record<Platform, string> = {
  bluesky: "Full support. Sign in with Bluesky; Tendril never sees your password.",
  x: "Room search uses X's recent-search API. Follower lists need a higher X API tier; without it the Ledger counts follows.",
  threads: "Keyword search, replies, mentions and insights. Threads doesn't list followers, so follows are counted.",
  linkedin: "LinkedIn only allows sign-in and profile to third-party apps. Paste LinkedIn posts into Rooms to check and log replies.",
};

export default async function AccountsPage(props: PageProps<"/app/settings/accounts">) {
  const viewer = await requireUser();
  const accounts = await accountsFor(viewer.user.id);
  const q = await props.searchParams;
  const enabled = new Set(enabledPlatforms());
  const atLimit = accounts.length >= viewer.limits.accounts;

  return (
    <div className="flex flex-col gap-10">
      {typeof q.error === "string" && <Notice tone="error">{q.error}</Notice>}
      {typeof q.connected === "string" && <Notice tone="success">Connected. The first sync is running and takes a minute or two.</Notice>}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Connected accounts</h2>
          <span className="num text-[13px] text-muted">
            {accounts.length} of {viewer.limits.accounts}
          </span>
        </div>
        {accounts.length === 0 ? (
          <p className="text-[13px] text-muted">None yet.</p>
        ) : (
          <ul className="border-t border-line">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.handle} <span className="font-normal text-muted">· {PLATFORM_LABEL[a.platform]}</span>
                  </p>
                  <p className="text-[13px] text-muted">
                    {a.status === "reauth" ? "Needs reconnecting" : a.lastError ? a.lastError : `Synced ${relative(a.lastSyncedAt)}`} · {a.followers.toLocaleString()} followers
                  </p>
                </div>
                <AccountActions accountId={a.id} platform={a.platform} handle={a.handle} reauth={a.status === "reauth"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[17px] font-semibold">Connect</h2>
        {atLimit && <p className="mt-1 text-[13px] text-muted">You&apos;ve reached your plan&apos;s account limit. Upgrade in Billing to connect more.</p>}
        <div className="mt-4 grid gap-px border border-line bg-line md:grid-cols-2">
          {(Object.keys(providers) as Platform[]).map((p) => {
            const caps = providers[p].capabilities;
            const on = enabled.has(p);
            return (
              <div key={p} className="flex flex-col gap-3 bg-bg p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{PLATFORM_LABEL[p]}</h3>
                  {!on && <Tag>Not configured</Tag>}
                </div>
                <p className="text-[13px] text-ink-2">{NOTES[p]}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {CAPS.map((c) => (
                    <li key={c.key}>
                      <span className={`font-mono text-[11px] ${caps[c.key] ? "" : "text-faint line-through"}`}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {on && !atLimit && (
                  <div className="mt-auto pt-1">
                    {p === "bluesky" ? (
                      <form action="/api/connect/bluesky" method="get" className="flex gap-2">
                        <label htmlFor="bsky-handle" className="sr-only">
                          Bluesky handle
                        </label>
                        <input id="bsky-handle" name="handle" required placeholder="you.bsky.social" className="field h-9" autoComplete="username" />
                        <button className="h-9 shrink-0 rounded-md border border-ink bg-ink px-3.5 text-sm font-medium text-inverse">Connect</button>
                      </form>
                    ) : (
                      <a href={`/api/connect/${p}`} className="inline-flex h-9 items-center rounded-md border border-ink bg-ink px-3.5 text-sm font-medium text-inverse">
                        Connect {PLATFORM_LABEL[p]}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Tokens are encrypted at rest with AES-256-GCM. Tendril only posts when you press a Post button, and disconnecting deletes that account&apos;s data.
        </p>
      </section>
    </div>
  );
}
