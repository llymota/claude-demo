import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { TopicsEditor } from "@/components/topics-editor";
import { Button, Notice } from "@/components/ui";
import { finishOnboarding } from "@/app/app/actions";
import { enabledPlatforms } from "@/lib/providers";
import { PLATFORM_LABEL, type Platform } from "@/lib/providers/types";
import { accountsFor } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Set up Tendril" };

const STEPS = [
  { key: "topics", label: "What you know" },
  { key: "connect", label: "Connect accounts" },
] as const;

const WHY: Record<Platform, string> = {
  bluesky: "Full support: rooms, replies, circles, archive and per-follower attribution.",
  x: "Rooms and replies. Follower attribution depends on your X API tier.",
  threads: "Rooms, replies and mentions. Follows are counted, not listed.",
  linkedin: "Profile and follower count. Paste posts into Rooms to check replies.",
};

export default async function WelcomePage(props: PageProps<"/welcome">) {
  const viewer = await requireUser();
  if (viewer.workspace.onboardedAt) redirect("/app");
  const q = await props.searchParams;
  const step = q.step === "connect" && viewer.workspace.topics.length > 0 ? "connect" : "topics";
  const accounts = step === "connect" ? await accountsFor(viewer.user.id) : [];
  const connected = new Set(accounts.map((a) => a.platform));
  const enabled = enabledPlatforms();
  const atLimit = accounts.length >= viewer.limits.accounts;

  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between py-5">
        <Logo />
        <ol className="flex gap-5 text-[13px]" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s.key} aria-current={s.key === step ? "step" : undefined} className={s.key === step ? "font-medium" : "text-muted"}>
              <span className="num mr-1.5 text-[12px]">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 pt-8 pb-24">
        {step === "topics" ? (
          <>
            <p className="label">Step 1 of 2</p>
            <h1 className="mt-2 text-[26px] font-semibold">What can you talk about with real authority?</h1>
            <p className="mt-2 max-w-xl text-ink-2">
              Tendril finds live conversations on these topics where a reply from you would be seen, and weighs them by how well you know the subject. You can change this any time.
            </p>
            <div className="mt-8 border-t border-line pt-6">
              <TopicsEditor initial={viewer.workspace.topics} onboarding />
            </div>
          </>
        ) : (
          <>
            <p className="label">Step 2 of 2</p>
            <h1 className="mt-2 text-[26px] font-semibold">Connect the accounts you want to grow</h1>
            <p className="mt-2 max-w-xl text-ink-2">
              Tendril reads your posts, replies and followers to find rooms and attribute follows. It never posts unless you press Post.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {typeof q.error === "string" && <Notice tone="error">{q.error}</Notice>}
              {typeof q.connected === "string" && <Notice tone="success">Connected. The first sync is running in the background.</Notice>}
            </div>

            <ul className="mt-6 border-t border-line">
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => {
                const on = enabled.includes(p);
                const done = connected.has(p);
                return (
                  <li key={p} className="grid gap-3 border-b border-line py-5 md:grid-cols-[160px_minmax(0,1fr)_280px] md:items-center">
                    <p className="font-semibold">{PLATFORM_LABEL[p]}</p>
                    <p className="text-[13px] text-ink-2">{WHY[p]}</p>
                    <div className="md:justify-self-end">
                      {done ? (
                        <span className="font-mono text-[12px]">Connected</span>
                      ) : !on ? (
                        <span className="font-mono text-[12px] text-faint">Not configured</span>
                      ) : atLimit ? (
                        <span className="text-[12px] text-muted">Plan limit reached</span>
                      ) : p === "bluesky" ? (
                        <form action="/api/connect/bluesky" method="get" className="flex gap-2">
                          <input type="hidden" name="from" value="welcome" />
                          <label htmlFor="bsky-handle" className="sr-only">
                            Bluesky handle
                          </label>
                          <input id="bsky-handle" name="handle" required placeholder="you.bsky.social" className="field h-9" autoComplete="username" />
                          <button className="h-9 shrink-0 rounded-md border border-ink bg-ink px-3.5 text-sm font-medium text-inverse">Connect</button>
                        </form>
                      ) : (
                        <a href={`/api/connect/${p}?from=welcome`} className="inline-flex h-9 items-center rounded-md border border-ink px-3.5 text-sm font-medium hover:bg-hover">
                          Connect {PLATFORM_LABEL[p]}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <Link href="/welcome" className="text-[13px] text-muted underline underline-offset-2 hover:text-ink">
                Back to topics
              </Link>
              <form action={finishOnboarding} className="flex items-center gap-4">
                {accounts.length === 0 && <span className="text-[13px] text-muted">You can connect later in Settings.</span>}
                <Button variant="primary">{accounts.length === 0 ? "Skip for now" : "Open Tendril"}</Button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
