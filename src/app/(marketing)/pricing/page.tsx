import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { PLANS, type PlanSpec } from "@/lib/billing/plans";
import { getSession } from "@/lib/session";

export const metadata = { title: "Pricing" };

const ROWS: { label: string; value: (p: PlanSpec) => string }[] = [
  { label: "Connected accounts", value: (p) => String(p.limits.accounts) },
  { label: "Rooms per day", value: (p) => (Number.isFinite(p.limits.roomsPerDay) ? String(p.limits.roomsPerDay) : "Unlimited") },
  { label: "Sync interval", value: (p) => (p.limits.syncMinutes >= 60 ? `${p.limits.syncMinutes / 60} hours` : `${p.limits.syncMinutes} minutes`) },
  { label: "Reply check", value: () => "Yes" },
  { label: "Storefront check", value: () => "Yes" },
  { label: "Assistant (⌘K)", value: () => "Yes" },
  { label: "Autopilot and Inbox", value: (p) => (p.limits.autopilot ? "Yes" : "No") },
  { label: "AI credits a month", value: (p) => p.limits.aiCredits.toLocaleString() },
  { label: "Circles", value: (p) => (p.limits.circles ? "Yes" : "No") },
  { label: "Second Life", value: (p) => (p.limits.secondLife ? "Yes" : "No") },
  { label: "Ledger", value: (p) => (p.limits.ledger ? "Yes" : "No") },
  { label: "Post replies from Tendril", value: (p) => (p.limits.postFromTendril ? "Yes" : "No") },
  { label: "CSV export", value: (p) => (p.limits.export ? "Yes" : "No") },
];

export default async function PricingPage() {
  const session = await getSession().catch(() => null);
  const plans = Object.values(PLANS);
  const cta = session ? "/app/settings/billing" : "/sign-up";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
      <p className="label">Pricing</p>
      <h1 className="mt-3 text-[36px] font-semibold leading-tight">Pay for what the round saves you.</h1>
      <p className="mt-3 max-w-xl text-ink-2">Start free on one account. Upgrade when Tendril is paying for itself in followers. Monthly billing, cancel any time, prices in USD.</p>

      <div className="mt-10 grid gap-px border border-line bg-line md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`flex flex-col gap-4 bg-bg p-6 ${p.id === "grower" ? "outline outline-1 -outline-offset-1 outline-ink" : ""}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-semibold">{p.name}</h2>
              {p.id === "grower" && <span className="label text-ink">Most chosen</span>}
            </div>
            <p>
              <span className="num text-[32px]">${p.priceMonthly}</span>
              <span className="text-[13px] text-muted"> / month</span>
            </p>
            <p className="text-[13px] text-ink-2">{p.summary}</p>
            <ul className="flex flex-col gap-1.5 border-t border-line pt-4 text-[13px]">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href={cta} className={`${buttonClass(p.id === "grower" ? "primary" : "secondary")} mt-auto`}>
              {p.id === "free" ? "Start free" : `Choose ${p.name}`}
            </Link>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-[20px] font-semibold">Compare</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="label py-2 font-normal">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="label py-2 font-normal">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-line">
                <td className="py-2.5">{r.label}</td>
                {plans.map((p) => {
                  const v = r.value(p);
                  return (
                    <td key={p.id} className={`py-2.5 ${v === "No" ? "text-faint" : ""}`}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12 grid gap-6 border-t border-line pt-8 text-[13px] text-ink-2 md:grid-cols-3">
        <p>
          <span className="font-medium text-ink">Payments by Polar.</span> Polar is the merchant of record and handles tax and invoices. Tendril never sees your card.
        </p>
        <p>
          <span className="font-medium text-ink">Cancel any time.</span> You keep your plan until the end of the period you paid for, then drop to Seedling. Nothing is deleted.
        </p>
        <p>
          <span className="font-medium text-ink">Refunds.</span> If Tendril didn&apos;t work for you in your first 14 days, email us and we&apos;ll refund the month.
        </p>
      </div>
    </div>
  );
}
