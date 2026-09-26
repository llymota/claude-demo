# Tendril

**Grow on social media without making more content.**

An account with 2,000 followers posting into its own feed reaches the same 2,000 people. One useful reply in a 50,000-person thread reaches strangers who already care about the topic. Tendril is built around that asymmetry: it tells you where to show up, who to show up for, and which of your existing posts your newer followers never saw.

Live demo: https://claude.ai/artifact/XsDaQe6mrEa6Tj7uRGVB1i (landing page plus a working demo workspace; all people and numbers are invented)

## The product

Tendril replaces "post more" with a fifteen-minute **daily round**: three rooms to join, two people to check in with, one post to resurface and one profile fix.

| Tool | What it does | How it decides |
| --- | --- | --- |
| **Rooms** | Live radar of conversations worth replying to, with a reply workspace | Leverage score = topic fit (38%), earliness (24%), share of the room that has never seen you (22%), author rapport (16%), scaled by audience size. Threads past ~60 replies drop off, and each room shows when its window closes. |
| **Reply check** | Grades your reply *Invisible → Polite → Useful → Magnetic* as you type | Rewards numbers, first-hand experience, respectful tension and a closing question. Flags stock praise, links, self-promotion and emoji-only replies. It checks your words; it never writes them. |
| **Circles** | Relationship memory for anchors, peers, rising accounts and regulars | Warmth decays with a 21-day half-life. A reciprocity ledger shows who has shown up for whom, and nudges fire when you owe someone, a connection is cooling, or a small account is growing fast. |
| **Second Life** | Finds old posts your current audience missed | "Never saw it" = share of today's followers who followed after the post. Combined with save- and reply-weighted engagement. Suggests resharing, or using the post as material in a live room. Dated posts are retired. |
| **Storefront** | Turns profile visits into follows | Visit→follow conversion against a 15% benchmark, plus a first-impression check on bio and pinned post that re-runs as you edit. |
| **Ledger** | Shows which actions earned followers | Weekly follows attributed to replies, relationships, resurfaced posts and profile fixes. |

**What Tendril will never do:** post for you, write your replies, follow/unfollow, run engagement pods, read your DMs, or sell your graph.

**Pricing concept:** Seedling (free, one platform, five rooms a day), Grower ($19/mo, all four platforms, everything), Studio ($49/mo, three profiles, shared Circles).

## Running it

```sh
npm install
npm run dev          # local dev server
npm test             # scoring engine tests
npm run typecheck
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## Code map

- `src/lib/scoring.ts` holds every ranking and scoring rule described above, with tests in `scoring.test.ts`.
- `src/data/seed.ts` is the demo workspace (an invented founder, Priya Raman, and her network).
- `src/screens/` has one file per screen, plus `Landing.tsx`.
- `src/components/ReachMap.tsx` draws the canvas map of your audience and the rooms around it.

In production the seed data would be replaced by platform APIs (X, LinkedIn, Bluesky's AT Protocol, Threads) for conversations, follower history and interactions.
