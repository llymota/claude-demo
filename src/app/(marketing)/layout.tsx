import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/session";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" aria-label="Tendril home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-5 text-[13px]">
            <Link href="/#how" className="hidden text-ink-2 hover:text-ink sm:inline">
              How it works
            </Link>
            <Link href="/pricing" className="text-ink-2 hover:text-ink">
              Pricing
            </Link>
            {session ? (
              <Link href="/app" className={buttonClass("primary", "sm")}>
                Open app
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-ink-2 hover:text-ink">
                  Sign in
                </Link>
                <Link href="/sign-up" className={buttonClass("primary", "sm")}>
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted">
          <Logo className="text-ink" />
          <nav className="flex gap-5">
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
