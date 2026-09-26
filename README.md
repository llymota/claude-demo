# Tendril

**Grow on social media without making more content.**

An account with 2,000 followers posting into its own feed reaches the same 2,000 people. One useful reply in a 50,000-person thread reaches strangers who already care about the topic. Tendril is built around that asymmetry: it tells you where to show up, who to show up for, and which of your existing posts your newer followers never saw.

## The product

A fifteen-minute **daily round** instead of "post more".

| Tool | What it does |
| --- | --- |
| **Rooms** | Live conversations on your topics, ranked by leverage: topic fit, earliness, how much of the room has never seen you, and rapport with the author. Each room shows when its window closes. |
| **Reply check** | Grades your reply *Invisible, Polite, Useful, Magnetic* as you type. It checks your words; it never writes them. |
| **Circles** | Relationship memory built from real interactions: warmth (21-day half-life), reciprocity, and nudges when a connection is cooling. |
| **Second Life** | Past posts most of your current followers missed, from follower-growth history, with a one-click reshare. |
| **Storefront** | Bio and pinned post audit against the topics you want to be known for. |
| **Ledger** | Where new followers came from: replies, relationships, resurfaced posts, profile, or unattributed. |

Tendril never posts unless you press Post, never writes replies, and never follows, likes or schedules on your behalf.

## Stack

- Next.js 16 (App Router, server actions, `proxy.ts`), React 19, Tailwind CSS 4
- PostgreSQL with Drizzle ORM and checked-in migrations (`drizzle/`)
- Better Auth: email and password with verification and reset, optional Google and GitHub, DB-backed rate limits
- Polar for billing: checkout, customer portal and webhooks via `@polar-sh/better-auth`
- Platform APIs: Bluesky (atproto OAuth), X API v2 (OAuth 2.0 PKCE), Threads Graph API, LinkedIn (OpenID Connect)
- Platform tokens encrypted at rest with AES-256-GCM; structured JSON logs with secret redaction; audit events; GDPR export and deletion

## Run locally

```bash
cp .env.example .env.local        # fill in the three secrets (commands are in the file)
docker compose up -d db           # or any Postgres 16
npm install
npm run db:migrate
npm run dev                       # http://127.0.0.1:3000
```

Use `127.0.0.1`, not `localhost`: Bluesky's OAuth loopback client requires it. Without `RESEND_API_KEY`, emails are printed to the log and verification is skipped. Every optional integration switches on when its variables are set, and the UI shows "Not configured" until then.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

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

**Email**: a Resend API key and a verified sending domain in `EMAIL_FROM`.

**Social sign-in** (optional): Google and GitHub OAuth apps with callback `{APP_URL}/api/auth/callback/google` and `/github`.

## Deploy

**Vercel**: import the repo, set the environment variables, and run `npm run db:migrate` against the production database (locally or as a release step). `vercel.json` schedules `/api/cron/sync` every five minutes; Vercel sends `CRON_SECRET` as a bearer token.

**Docker**: `docker compose up --build` runs Postgres, applies migrations and starts the app on port 3000. For your own host, build the `app` target and run the `migrate` target before each release. Call the sync endpoint from any scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/sync
```

`/api/health` checks the database and is used by the container health check.

## Code map

```
src/app/(marketing)     landing, pricing, privacy, terms
src/app/(auth)          sign in, sign up, password reset
src/app/welcome         two-step onboarding
src/app/app             the product (Today, Rooms, Circles, Second Life, Storefront, Ledger, Settings)
src/app/api             auth, connect/callback per platform, cron sync, export, health
src/lib/providers       one adapter per platform behind a shared interface with capability flags
src/lib/sync.ts         per-account sync: profile, posts, rooms, interactions, followers, attribution
src/lib/scoring.ts      leverage, reply check, warmth, resurfacing, profile audit (unit tested)
src/lib/attribution.ts  follower attribution (unit tested)
src/lib/db/schema.ts    database schema
```

## Before launch

- Have the privacy policy and terms reviewed; they are starting templates.
- Submit the Threads and X apps for the access tiers you need.
- Switch `POLAR_SERVER` to `production` with production product ids and a new webhook.
