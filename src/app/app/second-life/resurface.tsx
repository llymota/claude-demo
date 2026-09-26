"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { resurface, setDated } from "../actions";

export function Resurface({ postId, canPost, platform, retiredOnly }: { postId: string; canPost: boolean; platform: string; retiredOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? "Done") : (r.error ?? "Something went wrong"));
      if (r.ok) router.refresh();
    });

  if (retiredOnly) {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setDated(postId, false))}>
        Restore
      </Button>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setOpen(true)}>
          Write a new first line
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setDated(postId, true))}>
          It&apos;s dated, retire it
        </Button>
        {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`rs-${postId}`} className="text-[13px] text-ink-2">
        A hook written for who follows you now. It goes out as a quote of the original.
      </label>
      <textarea id={`rs-${postId}`} className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <div className="flex flex-wrap items-center gap-2">
        {canPost && (
          <Button size="sm" variant="primary" disabled={!text.trim() || pending} onClick={() => act(() => resurface({ postId, text, mode: "post" }))}>
            {pending ? "Posting…" : `Quote on ${platform}`}
          </Button>
        )}
        <Button size="sm" disabled={!text.trim() || pending} onClick={() => act(() => resurface({ postId, text, mode: "log" }))}>
          I posted it myself
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
      </div>
    </div>
  );
}
