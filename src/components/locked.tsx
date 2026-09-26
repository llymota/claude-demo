import { ButtonLink, PageHeader } from "./ui";

export function Locked({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader label={label} title={title}>
        {children}
      </PageHeader>
      <div className="mt-8 border border-ink p-6">
        <p className="font-medium">{label} is part of Grower.</p>
        <p className="mt-1 max-w-lg text-[13px] text-ink-2">Grower is $19 a month for up to four accounts, with every tool and a sync every 15 minutes. Cancel any time.</p>
        <ButtonLink href="/app/settings/billing" variant="primary" className="mt-4">
          See plans
        </ButtonLink>
      </div>
    </>
  );
}
