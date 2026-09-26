import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full max-w-5xl items-center py-5">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-24">{children}</main>
    </div>
  );
}
