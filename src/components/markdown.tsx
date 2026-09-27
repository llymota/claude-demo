import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe renderer for assistant text: paragraphs, bullet and numbered lists,
 * **bold**, `code`, and links to pages inside the app. Anything else stays text.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*] /.test(l)))
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, k) => (
                <li key={k}>{inline(l.replace(/^\s*[-*] /, ""))}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+[.)] /.test(l)))
          return (
            <ol key={i} className="flex list-decimal flex-col gap-1 pl-5">
              {lines.map((l, k) => (
                <li key={k}>{inline(l.replace(/^\s*\d+[.)] /, ""))}</li>
              ))}
            </ol>
          );
        const heading = /^#{1,4} (.*)$/.exec(b);
        if (heading) return <p key={i} className="font-semibold">{inline(heading[1])}</p>;
        return (
          <p key={i}>
            {lines.map((l, k) => (
              <Fragment key={k}>
                {k > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>);
    else if (m[2]) out.push(<code key={m.index} className="rounded-sm bg-subtle px-1 font-mono text-[12px]">{m[2]}</code>);
    else if (m[4].startsWith("/app")) out.push(<Link key={m.index} href={m[4]} className="underline underline-offset-2">{m[3]}</Link>);
    else out.push(m[3]);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
