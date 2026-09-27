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
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env().EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text }),
    });
  } catch (err) {
    notSent(msg, String((err as Error).message));
    throw err;
  }
  if (!res.ok) {
    const body = await res.text();
    notSent(msg, `Resend returned ${res.status}: ${body.slice(0, 500)}`);
    throw new Error("Could not send email");
  }
}

/**
 * A failed email usually means the sending domain isn't verified in Resend yet. Locally,
 * print the message so you can still open the confirmation or reset link from the terminal.
 */
function notSent(msg: Message, reason: string) {
  log.error("email.failed", { to: msg.to, subject: msg.subject, reason, hint: "Check that the domain in EMAIL_FROM is verified at resend.com/domains" });
  if (process.env.NODE_ENV !== "production") log.warn("email.not_sent", { to: msg.to, subject: msg.subject, text: msg.text });
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
