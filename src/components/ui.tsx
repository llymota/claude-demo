import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-inverse border-ink hover:opacity-85",
  secondary: "bg-bg text-ink border-line-strong hover:border-ink",
  ghost: "bg-transparent text-ink border-transparent hover:bg-hover",
  danger: "bg-bg text-ink border-ink hover:bg-ink hover:text-inverse",
};

const SIZES = { sm: "h-7 px-2.5 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-[15px]" };

export function buttonClass(variant: Variant = "secondary", size: keyof typeof SIZES = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function PageHeader({ label, title, children, actions }: { label?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
      <div className="max-w-2xl">
        {label && <p className="label mb-2">{label}</p>}
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        {children && <div className="mt-2 text-[15px] text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, meta, children, className }: { title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("pt-8", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="label !text-ink">{title}</h2>
        {meta && <div className="text-[13px] text-muted">{meta}</div>}
      </div>
      {children}
    </section>
  );
}

export function Tag({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 font-mono text-[11px] leading-none",
        strong ? "border-ink bg-ink text-inverse" : "border-line-strong text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="h-1.5 w-full bg-subtle" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-5">
      <span className="label">{label}</span>
      <span className="num text-[30px] font-medium leading-none tracking-tight">{value}</span>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 border px-4 py-3 text-[13px]", tone === "error" ? "border-ink" : "border-line-strong bg-subtle")}>
      <span className="font-mono font-medium">{tone === "error" ? "!" : tone === "success" ? "✓" : "i"}</span>
      <div>{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-sm border border-line-strong px-1 font-mono text-[11px]">{children}</kbd>;
}
