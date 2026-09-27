"use client";

import { useState, useTransition } from "react";
import { ReplyCheck } from "@/components/reply-check";
import { Button, Notice } from "@/components/ui";
import { approveDraft, discardDraft, type ActionResult } from "../actions";

export interface DraftView {
  id: string;
  kind: string;
  account: string;
  platform: string;
  text: string;
  rationale: string | null;
  created: string;
  context: { title: string; body: string; href: string; external: string | null };
  canPost: boolean;
  isCheckin: boolean;
  maxLength: number;
}

export function DraftCard({ draft }: { draft: DraftView }) {
  const [text, setText] = useState(draft.text);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const over = text.length > draft.maxLength;
  const done = result?.ok;

  const act = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  return (
    <article className={`border ${done ? "border-line opacity-60" : "border-line-strong"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="text-[13px]">
          <span className="label mr-2 !text-ink">{draft.kind}</span>
          {draft.account}
        </p>
        <span className="text-[12px] text-muted">Prepared {draft.created}</span>
      </header>
      <div className="grid gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="border-b border-line p-4 md:border-r md:border-b-0">
          <p className="text-[13px] font-medium">{draft.context.title}</p>
          {draft.context.body && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink-2">{draft.context.body}</p>}
          <div className="mt-3 flex gap-4 text-[12px]">
            <a href={draft.context.href} className="underline underline-offset-2">
              Open in Tendril
            </a>
            {draft.context.external && (
              <a href={draft.context.external} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Open on {draft.platform} ↗
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="sr-only" htmlFor={`d-${draft.id}`}>
            Draft
          </label>
          <textarea id={`d-${draft.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={4} disabled={done} className="field resize-y text-[14px] leading-relaxed" />
          <div className="flex justify-between text-[12px] text-muted">
            <span>{draft.rationale}</span>
            <span className={`num shrink-0 pl-3 ${over ? "font-semibold text-ink" : ""}`}>
              {text.length}/{draft.maxLength}
            </span>
          </div>
          {!draft.isCheckin && <ReplyCheck text={text} />}
          {result && (result.ok ? <Notice tone="success">{result.message}{result.url && <> · <a className="underline" href={result.url} target="_blank" rel="noopener noreferrer">View</a></>}</Notice> : <Notice tone="error">{result.error}</Notice>)}
          {!done && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {draft.canPost && (
                <Button variant="primary" size="sm" disabled={pending || over || !text.trim()} onClick={() => act(() => approveDraft({ draftId: draft.id, text, mode: "post" }))}>
                  {pending ? "Posting…" : `Post to ${draft.platform}`}
                </Button>
              )}
              <Button
                size="sm"
                variant={draft.canPost ? "secondary" : "primary"}
                disabled={pending || !text.trim()}
                onClick={() => {
                  // Don't wait on the clipboard: some browsers leave the promise pending without permission.
                  void navigator.clipboard?.writeText(text).catch(() => {});
                  act(() => approveDraft({ draftId: draft.id, text, mode: "log" }));
                }}
              >
                {draft.isCheckin ? "Copy and log hello" : "Copy and mark posted"}
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={pending} onClick={() => act(() => discardDraft(draft.id))}>
                Discard
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
