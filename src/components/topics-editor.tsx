"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTopics } from "@/app/app/actions";
import { Button, Notice } from "./ui";

interface Topic {
  name: string;
  weight: number;
  keywords: string[];
}

const WEIGHTS = [
  { v: 1, label: "Core: my expertise" },
  { v: 0.8, label: "Strong: I have real experience" },
  { v: 0.5, label: "Some: I have opinions" },
  { v: 0.3, label: "Light: occasionally" },
];

const EXAMPLES: Topic[] = [
  { name: "pricing", weight: 1, keywords: ["pricing", "raise prices", "annual plan"] },
  { name: "bootstrapping", weight: 0.8, keywords: ["bootstrapped", "indie hacker", "solo founder"] },
];

export function TopicsEditor({ initial, onboarding }: { initial: Topic[]; onboarding?: boolean }) {
  const [topics, setTopics] = useState<Topic[]>(initial.length ? initial : [{ name: "", weight: 1, keywords: [] }]);
  const [drafts, setDrafts] = useState<string[]>(() => (initial.length ? initial : [{ keywords: [] }]).map((t) => t.keywords.join(", ")));
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (i: number, patch: Partial<Topic>) => setTopics((ts) => ts.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => {
    setTopics((ts) => ts.filter((_, k) => k !== i));
    setDrafts((ds) => ds.filter((_, k) => k !== i));
  };
  const add = (t: Topic = { name: "", weight: 0.8, keywords: [] }) => {
    setTopics((ts) => [...ts, t]);
    setDrafts((ds) => [...ds, t.keywords.join(", ")]);
  };

  const submit = () =>
    start(async () => {
      const clean = topics
        .map((t, i) => ({ ...t, name: t.name.trim().toLowerCase(), keywords: drafts[i].split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) }))
        .filter((t) => t.name);
      const r = await saveTopics(clean);
      setResult(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
      if (r.ok && onboarding) router.push("/welcome?step=connect");
      else if (r.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden grid-cols-[minmax(0,1fr)_200px_minmax(0,1.4fr)_32px] gap-3 md:grid">
        <span className="label">Topic</span>
        <span className="label">How well you know it</span>
        <span className="label">Search terms, comma separated</span>
        <span />
      </div>
      {topics.map((t, i) => (
        <div key={i} className="grid gap-2 border-b border-line pb-4 md:grid-cols-[minmax(0,1fr)_200px_minmax(0,1.4fr)_32px] md:gap-3 md:border-0 md:pb-0">
          <input aria-label="Topic name" className="field" placeholder="e.g. freelance finance" value={t.name} maxLength={40} onChange={(e) => update(i, { name: e.target.value })} />
          <select aria-label="Weight" className="field" value={t.weight} onChange={(e) => update(i, { weight: Number(e.target.value) })}>
            {WEIGHTS.map((w) => (
              <option key={w.v} value={w.v}>
                {w.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Search terms"
            className="field"
            placeholder="invoice, freelance taxes, quarterly taxes"
            value={drafts[i] ?? ""}
            onChange={(e) => setDrafts((ds) => ds.map((d, k) => (k === i ? e.target.value : d)))}
          />
          <button type="button" onClick={() => remove(i)} className="h-9 text-muted hover:text-ink" aria-label={`Remove ${t.name || "topic"}`}>
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {topics.length < 8 && (
          <Button type="button" size="sm" onClick={() => add()}>
            Add topic
          </Button>
        )}
        {topics.every((t) => !t.name) && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { setTopics(EXAMPLES); setDrafts(EXAMPLES.map((e) => e.keywords.join(", "))); }}>
            Fill with an example
          </Button>
        )}
      </div>
      <p className="text-[13px] text-muted">Tendril searches each term for fresh conversations and tags your own posts with the topics they match. Specific phrases find better rooms than single words.</p>
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.text}</Notice>}
      <div>
        <Button variant="primary" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : onboarding ? "Continue" : "Save topics"}
        </Button>
      </div>
    </div>
  );
}
