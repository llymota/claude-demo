import type { ReactNode } from "react";

export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16">
      <p className="label">Last updated {updated}</p>
      <h1 className="mt-3 text-[32px] font-semibold">{title}</h1>
      <div className="mt-8 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-6 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </article>
  );
}
