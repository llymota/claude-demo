import { Notice } from "@/components/ui";
import { eq } from "drizzle-orm";
import { polarSdk } from "@/lib/auth";
import { effectivePlan, PLANS, type Plan } from "@/lib/billing/plans";
import { applyCustomerState } from "@/lib/billing/sync";
import { db, schema } from "@/lib/db";
import { features } from "@/lib/env";
import { log } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { CheckoutButton, PortalButton } from "./billing-buttons";

export const metadata = { title: "Billing" };

export default async function BillingPage(props: PageProps<"/app/settings/billing">) {
  const viewer = await requireUser();
  const q = await props.searchParams;
  const polar = polarSdk();

  // Returning from checkout: pull the customer state now instead of waiting for the webhook.
  if (typeof q.checkout_id === "string" && polar) {
    try {
      await applyCustomerState(await polar.customers.getStateExternal({ externalId: viewer.user.id }));
    } catch (err) {
      log.warn("billing.state_refresh_failed", { error: err });
    }
  }
  // Read fresh: the checkout refresh above may have just changed it.
  const sub = (await db.query.subscription.findFirst({ where: eq(schema.subscription.userId, viewer.user.id) })) ?? null;
  const current = effectivePlan(sub);

  return (
    <div className="flex flex-col gap-10">
      {!features.polar() && <Notice>Billing isn&apos;t configured on this server. Set the Polar variables in the environment to enable checkout.</Notice>}
      {typeof q.checkout_id === "string" && <Notice tone="success">Thanks. Your payment went through. If your plan below hasn&apos;t changed yet, refresh in a few seconds.</Notice>}

      <section>
        <h2 className="text-[17px] font-semibold">Current plan</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border border-line p-5">
          <div>
            <p className="text-[20px] font-semibold">{PLANS[current].name}</p>
            <p className="text-[13px] text-muted">
              {current === "free"
                ? "Free forever. Upgrade any time."
                : sub?.cancelAtPeriodEnd && sub.currentPeriodEnd
                  ? `Cancelled. Access continues until ${sub.currentPeriodEnd.toISOString().slice(0, 10)}.`
                  : sub?.currentPeriodEnd
                    ? `$${PLANS[current].priceMonthly}/month · renews ${sub.currentPeriodEnd.toISOString().slice(0, 10)}`
                    : `$${PLANS[current].priceMonthly}/month`}
            </p>
          </div>
          {features.polar() && current !== "free" && <PortalButton />}
        </div>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold">Plans</h2>
        <div className="mt-3 grid gap-px border border-line bg-line md:grid-cols-3">
          {(Object.keys(PLANS) as Plan[]).map((id) => {
            const p = PLANS[id];
            const isCurrent = id === current;
            return (
              <div key={id} className={`flex flex-col gap-4 bg-bg p-5 ${isCurrent ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}>
                <div>
                  <p className="label">{p.name}</p>
                  <p className="mt-2 text-[28px] font-semibold leading-none">
                    ${p.priceMonthly}
                    <span className="ml-1 text-[13px] font-normal text-muted">/month</span>
                  </p>
                  <p className="mt-2 text-[13px] text-ink-2">{p.summary}</p>
                </div>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="grid grid-cols-[14px_1fr] gap-2">
                      <span aria-hidden="true">–</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <p className="text-[13px] font-medium">Your plan</p>
                  ) : id === "free" ? (
                    features.polar() && <p className="text-[13px] text-muted">Cancel from Manage billing to switch</p>
                  ) : (
                    features.polar() && (current === "free" ? <CheckoutButton slug={id} label={`Upgrade to ${p.name}`} /> : <PortalButton label={`Switch to ${p.name}`} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-muted">Payments, invoices and taxes are handled by Polar, our merchant of record. Prices in USD; local taxes may apply.</p>
      </section>
    </div>
  );
}
