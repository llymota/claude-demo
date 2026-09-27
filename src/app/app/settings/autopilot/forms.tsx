"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import type { AutopilotSettings } from "@/lib/db/schema";
import { relearnVoice, saveAutopilot, type ActionResult } from "../../actions";

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-6 border-b border-line py-4">
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--ink)]" />
    </label>
  );
}

export function AutopilotForm({ initial }: { initial: AutopilotSettings }) {
  const [s, setS] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<AutopilotSettings>) => setS((x) => ({ ...x, ...patch }));

  return (
    <div className="flex flex-col">
      <div className="border-t border-line">
        <Toggle id="ap-on" label="Run Autopilot every morning" hint="Triage, drafts, check-ins, reshare pick and brief." checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        <label htmlFor="ap-n" className="flex items-start justify-between gap-6 border-b border-line py-4">
          <span>
            <span className="block text-[14px] font-medium">Reply drafts per day</span>
            <span className="block text-[13px] text-muted">For the rooms with the most leverage. Each uses one credit.</span>
          </span>
          <select id="ap-n" value={s.draftsPerDay} onChange={(e) => set({ draftsPerDay: Number(e.target.value) })} className="field h-9 w-20">
            {[0, 1, 2, 3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Toggle id="ap-mail" label="Email me the morning brief" hint="What matters today and what's waiting in your Inbox." checked={s.digest} onChange={(v) => set({ digest: v })} />
        <Toggle
          id="ap-reshare"
          label="Reshare my best old post automatically"
          hint="The only thing Autopilot may post without asking: one of your own posts, quoted with a new first line, at most once a day. Replies always wait for you."
          checked={s.autoReshare}
          onChange={(v) => set({ autoReshare: v })}
        />
      </div>
      {result && <div className="mt-4">{result.ok ? <Notice tone="success">{result.message}</Notice> : <Notice tone="error">{result.error}</Notice>}</div>}
      <div className="mt-4">
        <Button variant="primary" disabled={pending} onClick={() => start(async () => setResult(await saveAutopilot(s)))}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function RelearnVoice() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await relearnVoice(); setMsg(r.ok ? (r.message ?? "Done") : r.error); })}>
        {pending ? "Reading your posts…" : "Relearn my voice"}
      </Button>
      {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
    </div>
  );
}
