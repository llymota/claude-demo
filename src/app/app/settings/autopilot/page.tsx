import { ButtonLink, Notice } from "@/components/ui";
import { creditsUsed } from "@/lib/ai/client";
import { DEFAULT_AUTOPILOT } from "@/lib/db/schema";
import { features } from "@/lib/env";
import { relative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { AutopilotForm, RelearnVoice } from "./forms";

export const metadata = { title: "Autopilot" };

export default async function AutopilotSettings() {
  const viewer = await requireUser();
  const ai = features.ai();
  const used = ai ? await creditsUsed(viewer.user.id) : 0;
  const limit = viewer.limits.aiCredits;
  const voice = viewer.workspace.voice;
  const settings = { ...DEFAULT_AUTOPILOT, ...viewer.workspace.autopilot };

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {!ai && <Notice tone="error">AI isn&apos;t configured on this server. Set ANTHROPIC_API_KEY to turn on Autopilot and the assistant.</Notice>}

      <section>
        <h2 className="text-[17px] font-semibold">Autopilot</h2>
        <p className="mt-1 text-[13px] text-muted">
          Once a day, Autopilot reads new rooms and hides bait and noise, drafts replies in your voice, prepares check-ins with people going cold, picks an old post to reshare,
          and writes your morning brief. Everything lands in your Inbox. {viewer.workspace.autopilotRanAt ? `Last ran ${relative(viewer.workspace.autopilotRanAt)}.` : "It hasn't run yet."}
        </p>
        {viewer.limits.autopilot ? (
          <div className="mt-5">
            <AutopilotForm initial={settings} />
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-4 border border-line p-4 text-[13px]">
            <span className="flex-1">Autopilot is part of Grower and Studio.</span>
            <ButtonLink href="/app/settings/billing" size="sm" variant="primary">
              See plans
            </ButtonLink>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[17px] font-semibold">Your voice</h2>
        <p className="mt-1 text-[13px] text-muted">Learned from your own posts and replies so drafts sound like you. It refreshes every two weeks.</p>
        {voice ? (
          <div className="mt-4 border border-line p-4 text-[14px]">
            <p>{voice.summary}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label mb-1.5">Habits</p>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-ink-2">
                  {voice.traits.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="label mb-1.5">Never</p>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-ink-2">
                  {voice.avoid.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-muted">
              Learned from {voice.learnedFrom} pieces of your writing, {relative(new Date(voice.learnedAt))}.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-[13px]">Not learned yet. Tendril needs at least five of your posts, which the first sync brings in.</p>
        )}
        {ai && (
          <div className="mt-3">
            <RelearnVoice />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[17px] font-semibold">AI credits</h2>
        <p className="mt-1 text-[13px] text-muted">One assistant question, one draft or one brief uses one credit. Credits reset on the 1st.</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-1.5 flex-1 bg-subtle" role="meter" aria-label="AI credits used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
            <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
          </div>
          <span className="num text-[13px]">
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      </section>
    </div>
  );
}
