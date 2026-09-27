import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { DevHost } from "@/components/dev-host";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Tendril: grow without posting more", template: "%s · Tendril" },
  description: "Tendril finds the conversations worth joining, drafts replies in your voice for you to approve, remembers the people who show up for you, and resurfaces the posts your new followers missed.",
  openGraph: { title: "Tendril", description: "Grow on social media without posting more.", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {process.env.NODE_ENV !== "production" && <DevHost appUrl={process.env.APP_URL || "http://127.0.0.1:3000"} />}
        {children}
      </body>
    </html>
  );
}
