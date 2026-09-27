import { Legal } from "../legal";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  const contact = process.env.SUPPORT_EMAIL ?? "privacy@tendril.app";
  return (
    <Legal title="Privacy policy" updated="September 27, 2026">
      <p>This policy explains what Tendril collects, why, and what you can do about it. It is a starting template; have it reviewed for your jurisdiction before launch.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your account: name, email address, password hash, and sign-in sessions.</li>
        <li>Connected social accounts: access tokens (encrypted with AES-256-GCM), your profile, posts, replies, mentions and follower changes.</li>
        <li>Public posts matching your topics, fetched to build Rooms.</li>
        <li>What you do in Tendril: topics, notes on people, completed round items, and replies you check or post.</li>
        <li>Billing status from Polar. We never receive card details.</li>
      </ul>
      <h2>How we use it</h2>
      <p>Only to run the product for you: finding rooms, scoring replies, remembering relationships and attributing follows. We don&apos;t sell data, show ads, or train models on your content. The assistant keeps your conversations with it so you can return to them; deleting your account deletes them.</p>
      <h2>Processors</h2>
      <ul>
        <li>Polar for payments and invoicing.</li>
        <li>Resend for transactional email.</li>
        <li>Anthropic, to run the assistant and Autopilot. Posts and data needed for a request are sent to its API; under Anthropic&apos;s commercial terms that data is not used to train models.</li>
          <li>TypeSafe AI, to classify posts and grade replies. The text of a post or reply is sent to its API for that single request.</li>
        <li>Our hosting and database providers.</li>
        <li>The social platforms you connect, under their own terms.</li>
      </ul>
      <h2>Retention and deletion</h2>
      <p>Disconnecting an account deletes its synced data. Deleting your Tendril account from Settings removes all of your data immediately and revokes any active subscription. You can export everything as JSON from Settings at any time.</p>
      <h2>Contact</h2>
      <p>
        Questions or requests: <a className="underline underline-offset-2" href={`mailto:${contact}`}>{contact}</a>.
      </p>
    </Legal>
  );
}
