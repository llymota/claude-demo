"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export function SocialButtons({ google, github }: { google: boolean; github: boolean }) {
  const params = useSearchParams();
  if (!google && !github) return null;
  const callbackURL = safeNext(params.get("next"));
  return (
    <div className="flex flex-col gap-2">
      {google && (
        <Button type="button" onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}>
          Continue with Google
        </Button>
      )}
      {github && (
        <Button type="button" onClick={() => authClient.signIn.social({ provider: "github", callbackURL })}>
          Continue with GitHub
        </Button>
      )}
      <div className="my-2 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const { error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")), rememberMe: true });
          if (error) {
            setError(error.status === 403 ? "Confirm your email first. We sent you a link." : error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect.");
            return;
          }
          router.push(safeNext(params.get("next")));
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        Email
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="flex justify-between">
          Password
          <Link href="/forgot-password" className="text-muted hover:text-ink">
            Forgot?
          </Link>
        </span>
        <input name="password" type="password" required autoComplete="current-password" className="field" />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" disabled={pending} className="mt-1">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignUpForm({ verify }: { verify: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent) {
    return (
      <Notice tone="success">
        We sent a confirmation link to <span className="font-medium">{sent}</span>. Open it to finish setting up Tendril.
      </Notice>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email"));
        start(async () => {
          const { error } = await authClient.signUp.email({ name: String(f.get("name")), email, password: String(f.get("password")), callbackURL: "/welcome" });
          if (error) {
            setError(error.status === 422 || /exist/i.test(error.message ?? "") ? "An account with this email already exists. Sign in instead." : (error.message ?? "Couldn't create your account."));
            return;
          }
          if (verify) setSent(email);
          else {
            router.push("/welcome");
            router.refresh();
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        Name
        <input name="name" required maxLength={80} autoComplete="name" className="field" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Email
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Password
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
        <span className="text-[12px] text-muted">At least 10 characters.</span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" disabled={pending} className="mt-1">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-[12px] text-muted">
        By creating an account you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <Notice tone="success">If an account exists for that email, a reset link is on its way. It expires in an hour.</Notice>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          await authClient.requestPasswordReset({ email: String(f.get("email")), redirectTo: "/reset-password" });
          setDone(true);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        Email
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(params.get("error") ? "This link is invalid or has expired. Request a new one." : null);
  const [pending, start] = useTransition();
  if (!token) return <Notice tone="error">{error ?? "This link is missing its token. Request a new one."}</Notice>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const { error } = await authClient.resetPassword({ newPassword: String(f.get("password")), token });
          if (error) return setError("This link is invalid or has expired. Request a new one.");
          router.push("/sign-in?reset=1");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        New password
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" disabled={pending}>
        Set password
      </Button>
    </form>
  );
}
