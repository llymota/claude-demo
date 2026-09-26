import { env, features } from "./env";
import { log } from "./log";

interface Message {
  to: string;
  subject: string;
  text: string;
}

/** Sends through Resend's HTTP API. Without a key (local development) the message is logged instead. */
export async function sendEmail(msg: Message) {
  if (!features.email()) {
    log.info("email.skipped", { to: msg.to, subject: msg.subject, text: msg.text });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env().EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text }),
  });
  if (!res.ok) {
    const body = await res.text();
    log.error("email.failed", { status: res.status, body: body.slice(0, 500) });
    throw new Error("Could not send email");
  }
}

export const templates = {
  verify: (url: string) => ({
    subject: "Confirm your email for Tendril",
    text: `Confirm your email address to finish setting up Tendril:\n\n${url}\n\nThe link expires in 24 hours. If you didn't sign up, ignore this email.`,
  }),
  reset: (url: string) => ({
    subject: "Reset your Tendril password",
    text: `Someone asked to reset the password for this email address.\n\n${url}\n\nThe link expires in 1 hour. If it wasn't you, ignore this email and your password stays the same.`,
  }),
};
