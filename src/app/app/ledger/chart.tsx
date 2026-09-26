"use client";

import { useState } from "react";

/* Monochrome by design: four evenly spaced grey steps plus a hatch, always paired with a legend and a table view. */
export const SOURCES = [
  { key: "replies", label: "Replies", fill: "var(--ink)" },
  { key: "relationships", label: "Relationships", fill: "var(--muted)" },
  { key: "resurfaced", label: "Second Life", fill: "var(--faint)" },
  { key: "profile", label: "Profile", fill: "var(--line-strong)" },
  { key: "unattributed", label: "Unattributed", fill: "url(#hatch)" },
] as const;

type Week = { week: string } & Record<(typeof SOURCES)[number]["key"], number>;

const W = 720;
const H = 260;
const M = { top: 16, right: 4, bottom: 28, left: 36 };

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s * 4 >= v) ?? pow * 10;
  return Math.ceil(v / step) * step;
}

export function FollowsChart({ weekly }: { weekly: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const totals = weekly.map((w) => SOURCES.reduce((n, s) => n + w[s.key], 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const band = innerW / Math.max(1, weekly.length);
  const barW = Math.min(36, band * 0.6);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const label = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Legend">
          {SOURCES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden="true">
                <rect width="10" height="10" fill={s.key === "unattributed" ? "none" : s.fill} stroke={s.key === "unattributed" ? "var(--muted)" : "none"} />
                {s.key === "unattributed" && <path d="M0 10L10 0" stroke="var(--muted)" />}
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setTable((t) => !t)} className="text-[12px] underline underline-offset-2" aria-pressed={table}>
          {table ? "Show chart" : "Show table"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-3 py-2 text-left font-normal">Week of</th>
                {SOURCES.map((s) => (
                  <th key={s.key} className="label px-3 py-2 text-right font-normal">
                    {s.label}
                  </th>
                ))}
                <th className="label px-3 py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w, i) => (
                <tr key={w.week} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">{label(w.week)}</td>
                  {SOURCES.map((s) => (
                    <td key={s.key} className="num px-3 py-2 text-right">
                      {w[s.key]}
                    </td>
                  ))}
                  <td className="num px-3 py-2 text-right font-medium">{totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="New followers per week, stacked by source">
            <defs>
              <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="var(--bg)" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--muted)" strokeWidth="1.5" />
              </pattern>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="num">
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </text>
              </g>
            ))}
            {weekly.map((w, i) => {
              const x = M.left + band * i + (band - barW) / 2;
              let acc = 0;
              return (
                <g key={w.week} opacity={hover === null || hover === i ? 1 : 0.35}>
                  {SOURCES.map((s) => {
                    const v = w[s.key];
                    if (!v) return null;
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    return <rect key={s.key} x={x} y={y1} width={barW} height={Math.max(0, y0 - y1 - 1.5)} fill={s.fill} stroke={s.key === "unattributed" ? "var(--muted)" : "none"} strokeWidth={0.75} />;
                  })}
                  {(weekly.length <= 8 || i % 2 === weekly.length % 2) && (
                    <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                      {label(w.week)}
                    </text>
                  )}
                  <rect
                    x={M.left + band * i}
                    y={M.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`Week of ${label(w.week)}: ${totals[i]} new followers`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="var(--ink)" />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 min-w-[170px] -translate-x-1/2 -translate-y-full border border-ink bg-bg p-2.5 text-[12px]"
              style={{ left: `${((M.left + band * hover + band / 2) / W) * 100}%`, top: `${(y(totals[hover]) / H) * 100}%`, marginTop: -8 }}
            >
              <p className="mb-1 font-medium">Week of {label(weekly[hover].week)}</p>
              {SOURCES.map((s) => (
                <p key={s.key} className="flex justify-between gap-4">
                  <span className="text-muted">{s.label}</span>
                  <span className="num">{weekly[hover][s.key]}</span>
                </p>
              ))}
              <p className="mt-1 flex justify-between border-t border-line pt-1 font-medium">
                <span>Total</span>
                <span className="num">{totals[hover]}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
