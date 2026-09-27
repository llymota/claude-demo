"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button, cx } from "@/components/ui";
import { listThreads, loadThread } from "../assistant-actions";

interface Msg {
  role: "user" | "assistant";
  text: string;
  tools?: string[];
  error?: string;
}

const PROMPTS = ["What should I do today?", "Draft a reply for my best room", "Who have I been neglecting?", "What earned me followers lately?"];

export function Assistant({ enabled, creditsLeft }: { enabled: boolean; creditsLeft: number }) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threads, setThreads] = useState<{ id: string; title: string }[] | null>(null);
  const [left, setLeft] = useState(creditsLeft);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string | undefined>).detail;
      if (q) setInput(q);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("tendril:ask", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tendril:ask", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setInput("");
      setBusy(true);
      setMsgs((m) => [...m, { role: "user", text: message }, { role: "assistant", text: "", tools: [] }]);
      const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
      try {
        const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, message }) });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Something went wrong." }));
          patch((m) => ({ ...m, error: err.error }));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.type === "thread") setThreadId(ev.id);
            else if (ev.type === "text") patch((m) => ({ ...m, text: m.text + ev.delta }));
            else if (ev.type === "tool") patch((m) => ({ ...m, text: m.text && !m.text.endsWith("\n\n") ? m.text + "\n\n" : m.text, tools: [...(m.tools ?? []), ev.label] }));
            else if (ev.type === "error") patch((m) => ({ ...m, error: ev.message }));
          }
        }
        setLeft((n) => Math.max(0, n - 1));
        router.refresh();
      } catch {
        patch((m) => ({ ...m, error: "Connection lost. Try again." }));
      } finally {
        setBusy(false);
      }
    },
    [busy, threadId, router],
  );

  const fresh = () => {
    setThreadId(undefined);
    setMsgs([]);
    setThreads(null);
    field.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-line-strong px-2.5 py-1.5 text-left text-[13px] text-ink-2 hover:border-ink hover:text-ink"
      >
        Ask Tendril
        <kbd className="font-mono text-[10px] text-muted">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Ask Tendril" className="flex h-full w-full max-w-[520px] flex-col border-l border-ink bg-bg">
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold">Ask Tendril</p>
                <p className="text-[12px] text-muted">Reads your rooms, circles, archive and Ledger. Drafts go to your Inbox; nothing is posted.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => setThreads(threads ? null : await listThreads())}
                  aria-expanded={Boolean(threads)}
                >
                  History
                </Button>
                <Button size="sm" variant="ghost" onClick={fresh}>
                  New
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </Button>
              </div>
            </header>

            {threads && (
              <ul className="max-h-60 overflow-y-auto border-b border-line">
                {threads.length === 0 && <li className="px-5 py-3 text-[13px] text-muted">No conversations yet.</li>}
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={cx("w-full truncate px-5 py-2 text-left text-[13px] hover:bg-hover", t.id === threadId && "font-medium")}
                      onClick={async () => {
                        setThreadId(t.id);
                        setMsgs(await loadThread(t.id));
                        setThreads(null);
                      }}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
              {!enabled ? (
                <p className="text-[13px] text-muted">The assistant needs an Anthropic API key on the server. Set ANTHROPIC_API_KEY and restart.</p>
              ) : msgs.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="label mb-1">Try</p>
                  {PROMPTS.map((p) => (
                    <button key={p} type="button" onClick={() => send(p)} className="rounded-md border border-line px-3 py-2 text-left text-[14px] hover:border-ink">
                      {p}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5 text-[14px] leading-relaxed">
                  {msgs.map((m, i) =>
                    m.role === "user" ? (
                      <p key={i} className="self-end rounded-md bg-ink px-3 py-2 text-inverse">
                        {m.text}
                      </p>
                    ) : (
                      <div key={i} className="flex flex-col gap-2">
                        {m.tools && m.tools.length > 0 && (
                          <ul className="flex flex-col gap-0.5">
                            {m.tools.map((t, k) => (
                              <li key={k} className="font-mono text-[11px] text-muted">
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                        {m.text ? <Markdown text={m.text} /> : busy && i === msgs.length - 1 && !m.error ? <p className="text-muted">Thinking…</p> : null}
                        {m.error && <p className="border-l-2 border-ink pl-3 text-[13px]">{m.error}</p>}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <form
              className="border-t border-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <label htmlFor="ask" className="sr-only">
                Ask Tendril
              </label>
              <textarea
                id="ask"
                ref={field}
                rows={2}
                value={input}
                disabled={!enabled}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about your rooms, people or growth…"
                className="field resize-none"
              />
              <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
                <span className="num">{left.toLocaleString()} credits left this month</span>
                <Button type="submit" size="sm" variant="primary" disabled={busy || !input.trim() || !enabled}>
                  {busy ? "Working…" : "Send"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

/** Opens the assistant with a question filled in. */
export function AskButton({ question, children, className }: { question: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className ?? "text-[13px] underline underline-offset-4"} onClick={() => window.dispatchEvent(new CustomEvent("tendril:ask", { detail: question }))}>
      {children}
    </button>
  );
}
