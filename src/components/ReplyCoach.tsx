import { useMemo, useState } from "react";
import { checkReply } from "../lib/scoring";

export const ANGLES = [
  { id: "number", name: "Add a number", hint: "One figure from your own work", starter: "In our numbers, " },
  { id: "scar", name: "Tell the scar", hint: "A mistake and what it cost you", starter: "When we " },
  { id: "yesbut", name: "Yes, but", hint: "Agree, then add the exception", starter: "Mostly agree, but " },
  { id: "question", name: "Sharper question", hint: "What the post raises but skips", starter: "Curious how you'd handle " },
] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
  id: string;
  label?: string;
  showAngles?: boolean;
}

export function ReplyMeter({ text }: { text: string }) {
  const result = useMemo(() => checkReply(text), [text]);
  const color =
    result.grade === "Magnetic" ? "var(--good)" : result.grade === "Useful" ? "var(--moss)" : result.grade === "Polite" ? "var(--warn)" : "var(--bad)";
  return (
    <div className="stack" style={{ gap: 12 }} aria-live="polite">
      <div className="meter-row">
        <span className={`grade grade-${result.grade}`}>{text.trim() ? result.grade : "Start typing"}</span>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.score} aria-label="Reply strength">
          <span style={{ width: `${result.score}%`, background: color }} />
        </div>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {result.score}/100
        </span>
      </div>
      {result.findings.length > 0 && (
        <ul className="findings">
          {result.findings.map((f) => (
            <li key={f.label}>
              <span className={`dot ${f.tone}`} aria-hidden="true" />
              <span>
                <b>{f.label}.</b> {f.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReplyCoach({ value, onChange, id, label = "Your reply", showAngles = true }: Props) {
  const [angle, setAngle] = useState<string | null>(null);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {showAngles && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Pick an angle</span>
          <div className="angles">
            {ANGLES.map((a) => (
              <button
                key={a.id}
                type="button"
                className="angle"
                aria-pressed={angle === a.id}
                onClick={() => {
                  setAngle(a.id);
                  if (!value.trim()) onChange(a.starter);
                }}
              >
                <b>{a.name}</b>
                <span>{a.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="stack" style={{ gap: 6 }} htmlFor={id}>
        <span className="eyebrow">{label}</span>
        <textarea id={id} className="reply" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write it in your own words. Tendril checks it, it never writes it." />
      </label>
      <ReplyMeter text={value} />
    </div>
  );
}
