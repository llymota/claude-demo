import type { NextConfig } from "next";
import { localHosts } from "./src/lib/local-hosts";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` only serves its dev scripts to localhost. Opening the app at 127.0.0.1 or at the
  // "Network:" address left a page whose buttons did nothing, so allow this machine's own addresses.
  allowedDevOrigins: localHosts(),
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.bsky.app" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "media.licdn.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
