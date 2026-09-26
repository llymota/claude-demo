import Link from "next/link";
import { ForgotForm } from "../auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-[24px] font-semibold">Reset your password</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">We&apos;ll email you a link to set a new one.</p>
      <ForgotForm />
      <Link href="/sign-in" className="mt-6 text-[13px] text-muted hover:text-ink">
        ← Back to sign in
      </Link>
    </>
  );
}
