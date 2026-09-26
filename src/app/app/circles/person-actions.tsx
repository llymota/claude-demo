"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { editPerson, markGreeted } from "../actions";

export function PersonActions({ personId, circle, note, pinned, compact }: { personId: string; circle: string; note: string; pinned: boolean; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [c, setC] = useState(pinned ? circle : "auto");
  const [n, setN] = useState(note);

  if (editing) {
    return (
      <form
        className="flex min-w-[220px] flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await editPerson({ personId, circle: c as "auto", note: n });
            setMsg(r.ok ? "Saved" : r.error);
            if (r.ok) setEditing(false);
          });
        }}
      >
        <select className="field" value={c} onChange={(e) => setC(e.target.value)} aria-label="Circle">
          <option value="auto">Automatic</option>
          <option value="anchor">Anchor</option>
          <option value="peer">Peer</option>
          <option value="rising">Rising</option>
          <option value="fan">Regular</option>
        </select>
        <textarea className="field" rows={2} value={n} onChange={(e) => setN(e.target.value)} maxLength={500} placeholder="Private note" aria-label="Note" />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={pending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-auto pt-1" : ""}`}>
      <Button
        size="sm"
        variant={compact ? "primary" : "secondary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markGreeted(personId);
            setMsg(r.ok ? (r.message ?? "Logged") : r.error);
          })
        }
      >
        I reached out
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Edit
      </Button>
      {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
    </div>
  );
}
