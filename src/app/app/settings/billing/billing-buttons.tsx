"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function CheckoutButton({ slug, label }: { slug: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await authClient.checkout({ slug });
          if (res?.error) {
            setError("Couldn't open checkout. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening checkout…" : label}
      </Button>
      {error && <p role="alert" className="text-[12px]">{error}</p>}
    </div>
  );
}

export function PortalButton({ label = "Manage billing" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await authClient.customer.portal();
        if (res?.error) setBusy(false);
      }}
    >
      {busy ? "Opening…" : label}
    </Button>
  );
}
