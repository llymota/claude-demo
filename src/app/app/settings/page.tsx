import { requireUser } from "@/lib/session";
import { DeleteAccount, NameForm, PasswordForm } from "./profile-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireUser();
  return (
    <div className="flex max-w-xl flex-col gap-10">
      <section>
        <h2 className="text-[17px] font-semibold">Profile</h2>
        <p className="mb-4 mt-1 text-[13px] text-muted">Signed in as {viewer.user.email}.</p>
        <NameForm name={viewer.user.name} />
      </section>
      <section className="border-t border-line pt-8">
        <h2 className="text-[17px] font-semibold">Password</h2>
        <p className="mb-4 mt-1 text-[13px] text-muted">Changing it signs you out everywhere else.</p>
        <PasswordForm />
      </section>
      <section className="border-t border-line pt-8">
        <h2 className="text-[17px] font-semibold">Your data</h2>
        <p className="mb-4 mt-1 text-[13px] text-muted">Download everything Tendril stores about you as JSON: accounts (without tokens), rooms, replies, people, posts and follower history.</p>
        <a href="/api/export" className="text-[14px] font-medium underline underline-offset-4">
          Download my data
        </a>
      </section>
      <section className="border-t border-line pt-8">
        <h2 className="text-[17px] font-semibold">Delete account</h2>
        <p className="mb-4 mt-1 text-[13px] text-muted">
          Cancels any subscription, disconnects every social account and permanently deletes your data. This can&apos;t be undone.
        </p>
        <DeleteAccount email={viewer.user.email} />
      </section>
    </div>
  );
}
