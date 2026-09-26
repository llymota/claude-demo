"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { addManualRoom, type ActionResult } from "../actions";

export function AddRoom({ accounts }: { accounts: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addManualRoom, null);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1 text-[13px]">
        Account
        <select name="accountId" className="field" defaultValue={accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Post link
        <input name="url" type="url" required className="field" placeholder="https://" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Author
        <input name="author" required className="field" maxLength={80} />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Post text
        <textarea name="text" required rows={4} className="field resize-y" maxLength={3000} />
      </label>
      {state && !state.ok && <p role="alert" className="text-[13px] font-medium">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add room"}
      </Button>
    </form>
  );
}
