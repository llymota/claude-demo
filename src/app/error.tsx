"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-4">
      <p className="label">Error</p>
      <h1 className="mt-2 text-[26px] font-semibold">Something went wrong.</h1>
      <p className="mt-2 text-ink-2">It&apos;s been logged. Try again, and if it keeps happening, email support with this reference.</p>
      {error.digest && <p className="num mt-3 text-[12px] text-muted">Ref {error.digest}</p>}
      <Button variant="secondary" className="mt-6 self-start" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
