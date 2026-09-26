import { Suspense } from "react";
import { ResetForm } from "../auth-forms";

export const metadata = { title: "Set a new password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="mb-6 text-[24px] font-semibold">Set a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
