"use client";

import { useMemo, useState } from "react";
import { auditProfile, type TopicDef } from "@/lib/scoring";

interface Props {
  bio: string;
  pinned: { text: string; postedAt: string; url?: string } | null;
  topics: TopicDef[];
  name: string;
  handle: string;
  followers: number;
  editUrl: string;
}

export function BioLab({ bio, pinned, topics, name, handle, followers, editUrl }: Props) {
  const [draft, setDraft] = useState(bio);
  const checks = useMemo(() => auditProfile({ bio: draft, pinned, topics }), [draft, pinned, topics]);
  const passing = checks.filter((c) => c.ok).length;
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="border border-line p-5">
          <p className="font-semibold">{name}</p>
          <p className="text-[13px] text-muted">
            @{handle} · {followers.toLocaleString()} followers
          </p>
          <label htmlFor={`bio-${handle}`} className="label mt-4 block">
            Bio · edit to re-check
          </label>
          <textarea id={`bio-${handle}`} className="field mt-1.5 resize-y" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={256} />
          <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
            <span className="num">{draft.length} characters</span>
            <span className="flex gap-3">
              {draft !== bio && (
                <button type="button" className="underline underline-offset-2" onClick={() => setDraft(bio)}>
                  Reset
                </button>
              )}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a href={editUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Edit profile ↗
              </a>
            </span>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <p className="label">Pinned post</p>
            {pinned ? (
              <p className="mt-1.5 text-[13px] text-ink-2">
                “{pinned.text.slice(0, 220)}” <span className="text-muted">· {pinned.postedAt.slice(0, 10)}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted">None pinned{handle ? "" : ""}.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="label !text-ink">First-impression check</p>
          <p className="num text-[13px]">
            {passing}/{checks.length} passing
          </p>
        </div>
        <ul className="border-t border-line">
          {checks.map((c) => (
            <li key={c.id} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-line py-3">
              <span className={`num mt-0.5 grid h-4 w-4 place-items-center border border-ink text-[10px] ${c.ok ? "bg-ink text-inverse" : ""}`} aria-label={c.ok ? "Passing" : "Needs work"}>
                {c.ok ? "✓" : ""}
              </span>
              <div>
                <p className={c.ok ? "text-muted" : "font-medium"}>{c.label}</p>
                {!c.ok && <p className="mt-0.5 text-[13px] text-ink-2">{c.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
