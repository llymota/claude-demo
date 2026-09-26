import type { ReactNode } from "react";

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Logo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="var(--moss)" />
    <path d="M9 23c0-7 4-11 11-12" stroke="var(--moss-ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path d="M14 17c-2.5-.4-4-2.2-4.2-5 2.8.1 4.6 1.6 5 4" fill="var(--moss-ink)" />
    <circle cx="21.5" cy="10.5" r="2.6" fill="var(--pollen)" />
  </svg>
);

export const Icon = {
  today: () => (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  rooms: () => (
    <Svg>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6M9 14h4" />
    </Svg>
  ),
  circles: () => (
    <Svg>
      <circle cx="9" cy="10" r="5" />
      <circle cx="16" cy="14" r="5" />
    </Svg>
  ),
  secondLife: () => (
    <Svg>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </Svg>
  ),
  storefront: () => (
    <Svg>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 16c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7" />
    </Svg>
  ),
  ledger: () => (
    <Svg>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  check: () => (
    <Svg size={14}>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.6" />
    </Svg>
  ),
  clock: () => (
    <Svg size={13}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  arrow: () => (
    <Svg size={15}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
};

export function Avatar({ name, size = "" }: { name: string; size?: "" | "sm" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Stable hue per person, kept in the moss/sky/pollen family.
  const hues = ["var(--moss)", "#3e7cb1", "#9a6400", "#7b5aa6", "#2e8a8a", "#b3572f"];
  const h = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % hues.length;
  return (
    <span className={`avatar ${size}`} style={{ background: hues[h], color: h === 0 ? "var(--moss-ink)" : "#fff" }} aria-hidden="true">
      {initials}
    </span>
  );
}
