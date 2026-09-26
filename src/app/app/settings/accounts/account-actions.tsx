"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { disconnectAccount, syncNow } from "../../actions";

export function AccountActions({ accountId, platform, handle, reauth }: { accountId: string; platform: string; handle: string; reauth: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const reconnectHref = platform === "bluesky" ? `/api/connect/bluesky?handle=${encodeURIComponent(handle)}` : `/api/connect/${platform}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {msg && <span className="text-[12px] text-muted" role="status">{msg}</span>}
      {reauth ? (
        <a href={reconnectHref} className="inline-flex h-7 items-center rounded-md border border-ink bg-ink px-2.5 text-[13px] font-medium text-inverse">
          Reconnect
        </a>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncNow(accountId);
              setMsg(r.ok ? (r.message ?? null) : r.error);
            })
          }
        >
          Sync now
        </Button>
      )}
      {confirming ? (
        <>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await disconnectAccount(accountId);
                setMsg(r.ok ? (r.message ?? null) : r.error);
                setConfirming(false);
                router.refresh();
              })
            }
          >
            Delete data and disconnect
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Disconnect
        </Button>
      )}
    </div>
  );
}
