"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings", label: "Profile" },
  { href: "/app/settings/accounts", label: "Accounts" },
  { href: "/app/settings/topics", label: "Topics" },
  { href: "/app/settings/autopilot", label: "Autopilot" },
  { href: "/app/settings/billing", label: "Billing" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-6 overflow-x-auto border-b border-line">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`-mb-px border-b-2 py-3 text-[14px] ${active ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
