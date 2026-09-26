import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <p className="label">404</p>
      <h1 className="mt-2 text-[26px] font-semibold">This page doesn&apos;t exist.</h1>
      <p className="mt-2 text-ink-2">The link may be old, or the thing it pointed to was deleted.</p>
      <Link href="/" className={`${buttonClass("secondary")} mt-6 self-start`}>
        Go home
      </Link>
    </main>
  );
}
