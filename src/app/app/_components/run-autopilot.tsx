"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { runAutopilotNow } from "../actions";

export function RunAutopilot({ label = "Run Autopilot now" }: { label?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runAutopilotNow();
            setMsg(r.ok ? (r.message ?? "Done") : r.error);
          })
        }
      >
        {pending ? "Autopilot is working…" : label}
      </Button>
    </div>
  );
}
