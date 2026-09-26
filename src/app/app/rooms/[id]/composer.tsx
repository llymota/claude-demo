"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReplyCheck } from "@/components/reply-check";
import { Button, Notice } from "@/components/ui";
import { dismissRoom, sendReply, type ActionResult } from "../../actions";

const ANGLES = [
  { id: "number", name: "Add a number", hint: "One figure from your own work", starter: "In our numbers, " },
  { id: "scar", name: "Tell the scar", hint: "A mistake and what it cost", starter: "When we " },
  { id: "yesbut", name: "Yes, but", hint: "Agree, then add the exception", starter: "Mostly agree, but " },
  { id: "question", name: "Sharper question", hint: "What the post raises but skips", starter: "Curious how you'd handle " },
];

interface Props {
  roomId: string;
  canPost: boolean;
  planAllowsPost: boolean;
  platform: string;
  maxLength: number;
}

export function Composer({ roomId, canPost, planAllowsPost, platform, maxLength }: Props) {
  const [text, setText] = useState("");
  const [angle, setAngle] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const over = text.length > maxLength;

  const run = (mode: "post" | "log") =>
    start(async () => {
      const r = await sendReply({ roomId, text, mode });
      setResult(r);
      if (r.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="label mb-2">Pick an angle</legend>
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {ANGLES.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={angle === a.id}
              onClick={() => {
                setAngle(a.id);
                if (!text.trim()) setText(a.starter);
              }}
              className="bg-bg p-3 text-left transition hover:bg-subtle aria-pressed:bg-ink aria-pressed:text-inverse"
            >
              <span className="block text-[13px] font-medium">{a.name}</span>
              <span className="block text-[12px] opacity-70">{a.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="reply" className="label !text-ink">
            Your reply
          </label>
          <span className={`num text-[12px] ${over ? "font-semibold text-ink" : "text-muted"}`}>
            {text.length}/{maxLength}
          </span>
        </div>
        <textarea
          id="reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="field resize-y text-[15px] leading-relaxed"
          placeholder="Write it in your own words. Tendril checks it; it never writes it."
        />
      </div>

      <ReplyCheck text={text} />

      {result && (result.ok ? <Notice tone="success">{result.message}{result.url && <> · <a className="underline" href={result.url} target="_blank" rel="noopener noreferrer">View</a></>}</Notice> : <Notice tone="error">{result.error}</Notice>)}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {canPost && (
          <Button variant="primary" disabled={!text.trim() || over || pending || !planAllowsPost} onClick={() => run("post")} title={planAllowsPost ? undefined : "Part of Grower"}>
            {pending ? "Posting…" : `Post to ${platform}`}
          </Button>
        )}
        <Button
          variant={canPost ? "secondary" : "primary"}
          disabled={!text.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              (document.getElementById("reply") as HTMLTextAreaElement | null)?.select();
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="secondary" disabled={!text.trim() || pending} onClick={() => run("log")}>
          I posted it myself
        </Button>
        <Button
          variant="ghost"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await dismissRoom(roomId);
              router.push("/app/rooms");
            })
          }
        >
          Hide room
        </Button>
      </div>
      {canPost && !planAllowsPost && <p className="text-[12px] text-muted">Posting from Tendril is part of Grower. You can still copy the reply and log it.</p>}
    </div>
  );
}
