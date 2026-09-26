"use client";

import { useMemo } from "react";
import { checkReply } from "@/lib/scoring";

const MARK = { good: "+", warn: "~", bad: "−" } as const;

/** Live grade for a reply. Runs entirely in the browser; nothing is sent while typing. */
export function ReplyCheck({ text }: { text: string }) {
  const r = useMemo(() => checkReply(text), [text]);
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
