"use client";

import { useEffect, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Development only. The browser treats localhost, 127.0.0.1 and the network address as
 * separate sites, so a session made on one is missing on the others, and account
 * connections and email links always return to APP_URL. This keeps you on APP_URL.
 */
export function DevHost({ appUrl }: { appUrl: string }) {
  const host = useSyncExternalStore(noop, () => window.location.host, () => null);
  const want = new URL(appUrl);
  // localhost is always this machine, so moving to 127.0.0.1 is safe. (A server-side
  // redirect can't do this: Next rewrites it into a relative redirect that loops.)
  const move = host !== null && host.startsWith("localhost") && host.replace("localhost", "127.0.0.1") === want.host;
  useEffect(() => {
    if (move) window.location.replace(`${want.origin}${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, [move, want.origin]);
  const elsewhere = host && host !== want.host && !move ? host : null;
  if (!elsewhere) return null;
  return (
    <div role="status" className="border-b border-line bg-subtle px-4 py-2 text-center text-[13px]">
      You opened Tendril at {elsewhere}, but APP_URL is {want.host}. Signing in works here, but connecting accounts and email links go to{" "}
      <a href={appUrl} className="underline underline-offset-2">
        {appUrl}
      </a>
      . Open that address, or set APP_URL in .env.local to this one and restart.
    </div>
  );
}
