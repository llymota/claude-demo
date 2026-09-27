"use client";

import { useState } from "react";
import { ReplyCheck } from "@/components/reply-check";

const SAMPLES = [
  { label: "Weak", text: "Great post! 🔥 So true." },
  { label: "Strong", text: "We raised prices 40% last spring and churn went down, not up. The trick was grandfathering annual plans for 90 days. What did you do with existing customers?" },
];

export function ReplyDemo() {
  const [text, setText] = useState(SAMPLES[0].text);
  return (
    <div className="grid border border-line md:grid-cols-2">
      <div className="border-b border-line p-5 md:border-r md:border-b-0">
        <p className="label mb-2">In the room</p>
        <p className="text-[13px] text-muted">@maya · 14 min ago · 38 replies</p>
        <p className="mt-1.5">Thinking about raising our prices for the first time. Terrified of churn. Anyone been through this?</p>
        <label htmlFor="demo-reply" className="label mt-5 mb-2 block">
          Your reply
        </label>
        <textarea id="demo-reply" value={text} onChange={(e) => setText(e.target.value)} rows={5} className="field resize-none" />
        <div className="mt-2 flex gap-3 text-[12px]">
          {SAMPLES.map((s) => (
            <button key={s.label} type="button" onClick={() => setText(s.text)} className="text-muted underline underline-offset-2 hover:text-ink">
              Try a {s.label.toLowerCase()} reply
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        <p className="label mb-3">Reply check</p>
        <ReplyCheck text={text} />
        <p className="mt-5 border-t border-line pt-3 text-[12px] text-muted">Runs in your browser. Autopilot grades every draft it writes with this same check before you see it.</p>
      </div>
    </div>
  );
}
