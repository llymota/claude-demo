import { useState } from "react";
import type { Source, WeeklyFollows } from "../lib/types";

/* Categorical order is fixed and validated for colour-vision deficiency in both themes. */
export const SOURCES: { key: Source; label: string; color: string }[] = [
  { key: "replies", label: "Replies in rooms", color: "var(--s1)" },
  { key: "relationships", label: "Relationships", color: "var(--s2)" },
  { key: "resurfaced", label: "Second Life posts", color: "var(--s3)" },
  { key: "profile", label: "Profile fixes", color: "var(--s4)" },
];

const W = 720;
const H = 270;
const M = { top: 12, right: 8, bottom: 30, left: 34 };

export function FollowsChart({ data }: { data: WeeklyFollows[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const totals = data.map((d) => SOURCES.reduce((n, s) => n + d[s.key], 0));
  const max = Math.ceil(Math.max(...totals) / 20) * 20;
  const ticks = Array.from({ length: max / 20 + 1 }, (_, i) => i * 20);
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const band = innerW / data.length;
  const barW = Math.min(34, band * 0.62);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row wrap" style={{ justifyContent: "space-between", gap: 10 }}>
        <div className="legend" aria-label="Legend">
          {SOURCES.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <button type="button" className="btn small ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week of</th>
                {SOURCES.map((s) => (
                  <th key={s.key} className="n">
                    {s.label}
                  </th>
                ))}
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.week}>
                  <td>{d.week}</td>
                  {SOURCES.map((s) => (
                    <td key={s.key} className="n">
                      {d[s.key]}
                    </td>
                  ))}
                  <td className="n">{totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="New followers per week, stacked by what earned them">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = M.left + band * i + (band - barW) / 2;
              let acc = 0;
              return (
                <g key={d.week} opacity={hover === null || hover === i ? 1 : 0.45}>
                  {SOURCES.map((s, si) => {
                    const v = d[s.key];
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    const isTop = si === SOURCES.length - 1;
                    const hgt = Math.max(0, y0 - y1 - 2);
                    return isTop ? (
                      <path key={s.key} d={roundedTop(x, y1, barW, Math.max(0, y0 - y1), 4)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={x} y={y1 + 2} width={barW} height={hgt} fill={s.color} />
                    );
                  })}
                  {(i % 2 === 1 || data.length <= 8) && (
                    <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">
                      {d.week}
                    </text>
                  )}
                  {i === data.length - 1 && (
                    <text x={x + barW / 2} y={y(totals[i]) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-mono)">
                      {totals[i]}
                    </text>
                  )}
                  <rect
                    x={M.left + band * i}
                    y={M.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onTouchStart={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${d.week}: ${totals[i]} new followers`}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div className="tooltip" style={{ left: `${((M.left + band * hover + band / 2) / W) * 100}%`, top: `${(y(totals[hover]) / H) * 100}%` }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Week of {data[hover].week}</div>
              {[...SOURCES].reverse().map((s) => (
                <div className="kv" key={s.key}>
                  <span>
                    <i style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="mono">{data[hover][s.key]}</span>
                </div>
              ))}
              <div className="kv" style={{ marginTop: 4, fontWeight: 700 }}>
                <span>Total</span>
                <span className="mono">{totals[hover]}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
