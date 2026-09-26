import { Empty, PageHeader, ButtonLink } from "@/components/ui";
import { PLATFORM_LABEL } from "@/lib/providers/types";
import { accountsFor } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { BioLab } from "./bio-lab";

export const metadata = { title: "Storefront" };

export default async function StorefrontPage() {
  const viewer = await requireUser();
  const accounts = await accountsFor(viewer.user.id);

  return (
    <>
      <PageHeader label="Storefront" title="Turn the visits you earn into follows">
        Every good reply sends people to your profile, and they decide in seconds. Platforms don&apos;t share profile-visit numbers, so Tendril checks what a visitor
        actually sees against the topics that brought them.
      </PageHeader>
      {accounts.length === 0 ? (
        <div className="pt-8">
          <Empty title="No accounts connected" action={<ButtonLink href="/app/settings/accounts" variant="primary">Connect an account</ButtonLink>} />
        </div>
      ) : (
        <div className="flex flex-col">
          {accounts.map((a) => (
            <section key={a.id} className="border-b border-line py-8 last:border-0">
              <p className="label mb-4">
                {PLATFORM_LABEL[a.platform]} · {a.handle}
              </p>
              <BioLab
                bio={a.bio ?? ""}
                pinned={a.pinnedPost ?? null}
                topics={viewer.workspace.topics}
                name={a.displayName ?? a.handle}
                handle={a.handle}
                followers={a.followers}
                editUrl={
                  { bluesky: "https://bsky.app/settings", x: "https://x.com/settings/profile", threads: "https://www.threads.net/", linkedin: "https://www.linkedin.com/in/me/" }[a.platform]
                }
              />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
