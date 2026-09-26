"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { deleteAccount, updateName, type ActionResult } from "../actions";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateName, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px]">
        Name
        <input name="name" defaultValue={name} required maxLength={80} className="field" autoComplete="name" />
      </label>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const { error } = await authClient.changePassword({
            currentPassword: String(f.get("current")),
            newPassword: String(f.get("next")),
            revokeOtherSessions: true,
          });
          setMsg(error ? { ok: false, text: error.message ?? "Couldn't change your password" } : { ok: true, text: "Password changed" });
          if (!error) form.reset();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        Current password
        <input name="current" type="password" required className="field" autoComplete="current-password" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        New password
        <input name="next" type="password" required minLength={10} className="field" autoComplete="new-password" />
      </label>
      <p className="text-[12px] text-muted">At least 10 characters. If you signed up with Google or GitHub, use “Forgot password” on the sign-in page to set one.</p>
      {msg && <Notice tone={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccount({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deleteAccount, null);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px]">
        Type <span className="font-mono">{email}</span> to confirm
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className="field" autoComplete="off" />
      </label>
      {state && !state.ok && <Notice tone="error">{state.error}</Notice>}
      <div>
        <Button type="submit" variant="danger" disabled={pending || typed !== email}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
