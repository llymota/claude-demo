import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { features } from "@/lib/env";
import { getSession } from "@/lib/session";
import { SignUpForm, SocialButtons } from "../auth-forms";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/app");
  return (
    <>
      <h1 className="text-[24px] font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        Free for one account. Already have one?{" "}
        <Link href="/sign-in" className="text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
      <Suspense>
        <SocialButtons google={features.google()} github={features.github()} />
        <SignUpForm verify={features.email()} />
      </Suspense>
    </>
  );
}
