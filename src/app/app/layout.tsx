import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Notice } from "@/components/ui";
import { PLANS } from "@/lib/billing/plans";
import { accountsFor, openRooms } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { Nav, SignOut, TimezoneSync } from "./_components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireUser();
  if (!viewer.workspace.onboardedAt) redirect("/welcome");
  const accounts = await accountsFor(viewer.user.id);
  const rooms = await openRooms(viewer, accounts.map((a) => a.id));
  const reauth = accounts.filter((a) => a.status === "reauth");
  const l = viewer.limits;

  const items = [
    { href: "/app", label: "Today" },
    { href: "/app/rooms", label: "Rooms", count: rooms.filter((r) => r.status === "open").length },
    { href: "/app/circles", label: "Circles", locked: !l.circles },
    { href: "/app/second-life", label: "Second Life", locked: !l.secondLife },
    { href: "/app/storefront", label: "Storefront" },
    { href: "/app/ledger", label: "Ledger", locked: !l.ledger },
  ];

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[216px_minmax(0,1fr)]">
      <TimezoneSync current={viewer.workspace.timezone} />
      <aside className="sticky top-0 z-10 flex flex-col gap-4 border-b border-line bg-bg px-4 py-3 md:h-dvh md:gap-8 md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="flex items-center justify-between">
          <Link href="/app" className="text-[15px]">
            <Logo />
          </Link>
          <Link href="/app/settings" className="text-[13px] text-muted hover:text-ink md:hidden">
            Settings
          </Link>
        </div>
        <Nav items={items} />
        <div className="mt-auto hidden flex-col gap-3 border-t border-line pt-4 md:flex">
          <Link href="/app/settings/billing" className="flex items-center justify-between text-[13px]">
            <span className="text-muted">Plan</span>
            <span className="font-mono text-[12px]">{PLANS[viewer.plan].name}</span>
          </Link>
          <Link href="/app/settings" className="text-[13px] text-ink-2 hover:text-ink">
            Settings
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[13px]">{viewer.user.name}</p>
            <p className="truncate text-[12px] text-muted">{viewer.user.email}</p>
          </div>
          <SignOut />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-[1080px]">
          {reauth.length > 0 && (
            <div className="mb-6">
              <Notice tone="error">
                {reauth.map((a) => a.handle).join(", ")} stopped syncing and need{reauth.length === 1 ? "s" : ""} to be reconnected.{" "}
                <Link href="/app/settings/accounts" className="underline underline-offset-2">
                  Reconnect
                </Link>
              </Notice>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
