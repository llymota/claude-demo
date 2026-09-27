"use client";

import { useEffect, useMemo, useState } from "react";
import { gradeDraft } from "@/app/app/actions";
import { checkReply, type ReplyCheck as Check } from "@/lib/scoring";

const MARK = { good: "+", warn: "~", bad: "−" } as const;

/**
 * Live grade for a reply. The rule-based grade runs in the browser on every keystroke.
 * With `deep`, Jev grades it against the original post once typing pauses.
 */
export function ReplyCheck({ text, deep }: { text: string; deep?: { roomId?: string } }) {
  const rules = useMemo(() => checkReply(text), [text]);
  const [graded, setGraded] = useState<{ text: string; check: Check } | null>(null);
  const roomId = deep?.roomId;
  const wantDeep = Boolean(deep) && text.trim().length > 0;
  useEffect(() => {
    if (!wantDeep) return;
    let live = true;
    const t = setTimeout(() => {
      gradeDraft(text, roomId)
        .then((check) => live && check && setGraded({ text, check }))
        .catch(() => {});
    }, 700);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, roomId, wantDeep]);
  const fromJev = graded?.text === text ? graded.check : null;
  const r = fromJev ?? rules;
  const empty = !text.trim();
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-center gap-4">
        <span className="w-24 text-[15px] font-semibold">{empty ? "—" : r.grade}</span>
        <div className="relative h-1.5 flex-1 bg-subtle" role="meter" aria-label="Reply strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.score}>
          <div className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-200" style={{ width: `${r.score}%` }} />
          {[25, 48, 70].map((t) => (
            <span key={t} className="absolute inset-y-[-3px] w-px bg-line-strong" style={{ left: `${t}%` }} aria-hidden="true" />
          ))}
        </div>
        <span className="num w-12 text-right text-[12px] text-muted">{r.score}/100</span>
      </div>
      {wantDeep && (
        <p className="label" title={fromJev ? "Graded by Jev against the original post" : "Instant grade from Tendril's rules"}>
          {fromJev ? "Graded by Jev" : "Quick check"}
        </p>
      )}
      {r.findings.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {r.findings.map((f) => (
            <li key={f.label} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
              <span className="num font-medium" aria-label={f.tone === "good" ? "Strength" : "Issue"}>
                {MARK[f.tone]}
              </span>
              <span>
                <span className="font-medium">{f.label}.</span> <span className="text-ink-2">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
