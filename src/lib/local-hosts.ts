import { networkInterfaces } from "node:os";

/**
 * Every address this machine answers on: loopback plus its network IPs, the same ones
 * `next dev` prints as "Network:". Used to let the dev server and sign-in accept the app
 * however it's opened on your own machine or from a phone on the same network.
 */
export function localHosts(): string[] {
  const out = new Set(["localhost", "127.0.0.1"]);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4") out.add(a.address);
  }
  return [...out];
}
