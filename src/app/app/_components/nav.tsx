"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cx } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { setTimezone } from "../actions";

export interface NavItem {
  href: string;
  label: string;
  count?: number;
  locked?: boolean;
}

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Workspace" className="flex gap-0.5 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const active = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[14px] transition",
              active ? "bg-ink text-inverse" : "text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <span>{i.label}</span>
            {i.locked ? (
              <span className={cx("font-mono text-[10px]", active ? "text-inverse" : "text-faint")}>PRO</span>
            ) : i.count ? (
              <span className={cx("num text-[11px]", active ? "text-inverse" : "text-muted")}>{i.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-left text-[13px] text-muted hover:text-ink"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

/** Stores the browser's timezone so the daily round turns over at the user's midnight. */
export function TimezoneSync({ current }: { current: string }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) void setTimezone(tz);
  }, [current]);
  return null;
}
