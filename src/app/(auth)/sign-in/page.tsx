import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/ui";
import { features } from "@/lib/env";
import { getSession } from "@/lib/session";
import { SignInForm, SocialButtons } from "../auth-forms";

export const metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/app");
  const q = await props.searchParams;
  return (
    <>
      <h1 className="text-[24px] font-semibold">Sign in</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        New here?{" "}
        <Link href="/sign-up" className="text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
      {q.reset && <div className="mb-4"><Notice tone="success">Password updated. Sign in with the new one.</Notice></div>}
      <Suspense>
        <SocialButtons google={features.google()} github={features.github()} />
        <SignInForm />
      </Suspense>
    </>
  );
}
