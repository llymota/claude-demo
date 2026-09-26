import { Legal } from "../legal";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <Legal title="Terms of service" updated="September 26, 2026">
      <p>These terms govern your use of Tendril. They are a starting template; have them reviewed before launch.</p>
      <h2>Your account</h2>
      <p>You need to be at least 16 and give accurate information. You&apos;re responsible for what happens under your account and for keeping your password safe.</p>
      <h2>Acceptable use</h2>
      <p>Tendril is for genuine participation. Don&apos;t use it to spam, harass, impersonate, manipulate engagement, or break the rules of the platforms you connect. We may suspend accounts that do.</p>
      <h2>Your content</h2>
      <p>You own everything you write. You give us permission to store and process it only to provide the service to you.</p>
      <h2>Plans and billing</h2>
      <p>Paid plans renew monthly through Polar, our merchant of record, until cancelled. Cancelling keeps your plan until the end of the paid period. Prices may change with 30 days&apos; notice.</p>
      <h2>Third-party platforms</h2>
      <p>Bluesky, X, Threads and LinkedIn can change or withdraw their APIs at any time. Features that depend on them may change as a result, and we&apos;ll tell you when they do.</p>
      <h2>Liability</h2>
      <p>Tendril is provided as is. To the extent the law allows, our liability is limited to what you paid us in the twelve months before a claim.</p>
      <h2>Ending</h2>
      <p>You can delete your account at any time from Settings. We may end the service with 30 days&apos; notice and a refund of any unused prepaid period.</p>
    </Legal>
  );
}
