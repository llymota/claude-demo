# Tendril

**Grow on social media without making more content.**

An account with 2,000 followers posting into its own feed reaches the same 2,000 people. One useful reply in a 50,000-person thread reaches strangers who already care about the topic. Tendril is built around that asymmetry: it tells you where to show up, who to show up for, and which of your existing posts your newer followers never saw.

## The product

Tendril does the legwork of organic growth overnight and leaves you a ten-minute review in the morning.

| Feature | What it does |
| --- | --- |
| **Autopilot** | Once a day it reads new conversations and hides bait and noise, drafts replies in your voice for the best ones, prepares check-ins with people going cold, picks an old post to reshare and writes a morning brief (emailed if you want). Monday brings a weekly review of what earned followers. |
| **Inbox** | Everything Autopilot or the assistant prepared, next to its context. Edit, then post, copy or discard. Replies never post without your click. |
| **Assistant** | ⌘K from anywhere. Answers from your real rooms, circles, archive and Ledger through read-only tools, and can draft to your Inbox, add notes or hide rooms. It cannot post. |
| **Rooms** | Live conversations on your topics, ranked by leverage (topic fit, earliness, how much of the room has never seen you, rapport). Autopilot adds a verdict and the angle only you can bring. |
| **Reply check** | Grades a reply *Invisible, Polite, Useful, Magnetic* as you type. Autopilot grades its own drafts with it and rewrites weak ones before you see them. |
| **Circles** | Relationship memory from real interactions: warmth, reciprocity, and nudges when a connection cools, with an AI brief per person. |
| **Second Life** | Past posts most of your current followers missed, with a fresh opening line to reshare them. |
| **Storefront** | Bio and pinned post audit against the topics you want to be known for. |
| **Ledger** | Where new followers came from: replies, relationships, resurfaced posts, profile, or unattributed. |

Your voice profile is learned from your own posts and refreshed every two weeks (Settings > Autopilot). The only thing Autopilot may post without asking is a reshare of your own post, once a day, and only if you switch it on.

## Stack

- Next.js 16 (App Router, server actions, `proxy.ts`), React 19, Tailwind CSS 4
- PostgreSQL with Drizzle ORM and checked-in migrations (`drizzle/`); PGlite (embedded Postgres) for local development
- Claude via the Anthropic SDK: structured outputs for triage, drafts, voice and briefs; a streaming tool-use loop for the assistant; server-side fallbacks on every request; per-plan monthly AI credits
- Jev by TypeSafe AI for classification: which topics a post is about, whether a room is bait or spam, whether an old post is too dated to reshare, and how strong a reply is. Jev answers typed questions with confidence scores; the weights and thresholds stay in code (`src/lib/classify.ts`)
- Better Auth: email and password with verification and reset, optional Google and GitHub, DB-backed rate limits
- Polar for billing: checkout, customer portal and webhooks via `@polar-sh/better-auth`
- Platform APIs: Bluesky (atproto OAuth), X API v2 (OAuth 2.0 PKCE), Threads Graph API, LinkedIn (OpenID Connect)
- Platform tokens encrypted at rest with AES-256-GCM; structured JSON logs with secret redaction; audit events; GDPR export and deletion

## Run locally

```bash
npm install
npm run dev        # http://127.0.0.1:3000
```

That's it. Without a `DATABASE_URL`, Tendril starts an embedded Postgres in `.data/pglite` and migrates it, and generates its three secrets into `.data/dev-secrets.json`. Delete `.data` to start over.

Use `127.0.0.1`, not `localhost`: Bluesky's OAuth loopback client requires it, and Bluesky works locally with no setup. To turn on the assistant and Autopilot, put `ANTHROPIC_API_KEY=...` in `.env.local` and restart. Without an email key, emails are printed to the terminal and verification is skipped. Every other integration switches on when its variables are set (see `.env.example`), and the UI shows "Not configured" until then.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. `npm run db:studio` opens the database.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Add a Postgres database (Neon from the Vercel Marketplace sets `DATABASE_URL` for you).
3. Set `APP_URL` to your domain, plus `BETTER_AUTH_SECRET` (`openssl rand -base64 48`), `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), `CRON_SECRET` (`openssl rand -hex 24`), `ANTHROPIC_API_KEY`, and the integrations below.
4. Deploy. The `vercel-build` script applies migrations before every build.

`vercel.json` runs `/api/cron/sync` once a day, which works on the Hobby plan: it syncs accounts, triages new rooms and runs each paid user's Autopilot. Accounts also sync whenever their owner opens the app. On Vercel Pro, change the schedule to `*/15 * * * *` for background sync every 15 minutes. Vercel sends `CRON_SECRET` as a bearer token; any other scheduler can do the same:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/sync
```

`/api/health` checks the database.

## Configure integrations

All callback URLs use `APP_URL`.

**Polar (billing)**
1. Create an organization at polar.sh (use `POLAR_SERVER=sandbox` while testing).
2. Create two monthly recurring products, Grower ($19) and Studio ($49), and copy their ids into `POLAR_PRODUCT_GROWER` and `POLAR_PRODUCT_STUDIO`.
3. Create an organization access token: `POLAR_ACCESS_TOKEN`.
4. Add a webhook to `{APP_URL}/api/auth/polar/webhooks` with all subscription and customer events, and copy its secret into `POLAR_WEBHOOK_SECRET`.

Plan limits live in `src/lib/billing/plans.ts`. Customers are created in Polar on sign-up and keyed by user id; the webhook keeps the local `subscription` table in sync.

**Bluesky** works locally with no setup. In production run `npx tsx scripts/generate-bluesky-key.ts` and set `BLUESKY_PRIVATE_JWK`; the client metadata is served from `/oauth/bluesky/client-metadata.json`.

**X**: create an app in the X developer portal with OAuth 2.0 (confidential client), callback `{APP_URL}/api/connect/x/callback`, scopes `tweet.read tweet.write users.read follows.read like.read offline.access`. Room search needs the Basic tier or higher; per-follower Ledger needs follower lookup access.

**Threads**: create a Meta app with the Threads use case, add `{APP_URL}/api/connect/threads/callback` as a redirect URI, and request `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_read_replies`, `threads_keyword_search`, `threads_manage_insights` and `threads_manage_mentions`. Keyword search and some scopes need Meta app review.

**LinkedIn**: create an app with "Sign In with LinkedIn using OpenID Connect", callback `{APP_URL}/api/connect/linkedin/callback`. LinkedIn doesn't give third-party apps feed access, so LinkedIn runs in manual mode: paste posts into Rooms.

**Claude**: an API key from console.anthropic.com in `ANTHROPIC_API_KEY`. `AI_MODEL` defaults to `claude-opus-5`. Credits per plan are in `src/lib/billing/plans.ts`; usage is recorded per user per month in `ai_usage`.

**Jev**: an API key from console.typesafe.ai in `TYPESAFE_API_KEY`. `JEV_MODEL` is pinned to `jev-1.13.0` because the thresholds in `src/lib/classify.ts` were set against it; retune them before moving to a newer version. Jev isn't charged against AI credits (it costs fractions of a cent per thousand calls). Without a key, the same spots use the rules in `src/lib/scoring.ts`.

**Email**: a Resend API key and a verified sending domain in `EMAIL_FROM`.

**Social sign-in** (optional): Google and GitHub OAuth apps with callback `{APP_URL}/api/auth/callback/google` and `/github`.

## Code map

```
src/app/(marketing)     landing, pricing, privacy, terms
src/app/(auth)          sign in, sign up, password reset
src/app/welcome         two-step onboarding
src/app/app             the product (Today, Inbox, Rooms, Circles, Second Life, Storefront, Ledger, Settings)
src/app/api             auth, assistant stream, connect/callback per platform, cron, export, health
src/lib/ai              Claude client and credits, tasks (voice, triage, drafts, briefs), assistant tools
src/lib/autopilot.ts    the daily autonomous pass
src/lib/providers       one adapter per platform behind a shared interface with capability flags
src/lib/sync.ts         per-account sync: profile, posts, rooms, interactions, followers, attribution
src/lib/scoring.ts      leverage, reply check, warmth, resurfacing, profile audit (unit tested)
src/lib/classify.ts     questions for Jev and how its answers become tags, verdicts and grades (unit tested)
src/lib/jev.ts          Jev client with a fallback to the rules
src/lib/attribution.ts  follower attribution (unit tested)
src/lib/db/schema.ts    database schema
```

## Before launch

- Have the privacy policy and terms reviewed; they are starting templates.
- Submit the Threads and X apps for the access tiers you need.
- Switch `POLAR_SERVER` to `production` with production product ids and a new webhook.
