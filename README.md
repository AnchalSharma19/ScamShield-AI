<<<<<<< HEAD
# ScamShield AI

An AI-powered scam and fraud detection platform. Paste a suspicious message, job offer, screenshot, or URL and get an explainable risk score — combining an LLM analysis, a context-aware rule engine, URL technical checks, and RAG similarity against known scam patterns.

## Stack

- **Frontend/Backend:** Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui
- **AI:** Gemini API (`@google/generative-ai`, free tier), structured JSON prompts (`src/lib/ai/prompts.ts`)
- **Database/Auth/Storage:** Supabase (Postgres + pgvector, Auth, RLS)
- **OCR:** Tesseract.js (server-side, for screenshot analysis)
- **Charts:** Recharts
- **Validation:** Zod
- **Testing:** Vitest (unit) + Playwright (e2e)

## Architecture

Risk scoring never comes from the LLM alone. Four independent signals are combined with fixed weights (`src/lib/scam/scoring.ts`), renormalized when a signal isn't available (e.g. no URL in the message):

```
Final Score = AI Score × 0.40 + Rule Score × 0.30 + URL Score × 0.20 + Pattern Score × 0.10
```

- **AI score** — Gemini classification against the scam-indicator prompt (`src/lib/ai/analyzer.ts`)
- **Rule score** — a context-aware regex rule engine (`src/lib/scam/rules.ts`) that discounts matches preceded by a negation cue (e.g. "never share your OTP" doesn't score as an OTP *request*)
- **URL score** — real technical checks (HTTPS, redirects, IP-based host, shortener, suspicious domain shape) blended with an LLM read of those facts (`src/lib/url/`)
- **Pattern score** — RAG: pgvector similarity search against a `scam_patterns` table, only counted when a similar pattern is actually found (`src/lib/rag/`)

## Connected channels (WhatsApp, Instagram, Facebook, Telegram, SMS/MMS, Slack, Discord)

Users can connect their own messaging accounts at `/settings/channels`. Incoming messages are analyzed automatically through the same pipeline as the web UI, and the bot replies in-thread with a risk alert when the score clears the alert threshold (MEDIUM+). Flagged Slack/Discord threads also show up in `/inbox` alongside the Zernio-connected platforms.

Every platform funnels into one shared pipeline (`src/lib/channels/pipeline.ts:handleInboundChannelMessage`), which resolves the owning user, claims the message for idempotency, analyzes it, saves it, and replies if warranted. Each platform only supplies its own plumbing around that core:

- **WhatsApp / Instagram / Facebook / Telegram / SMS** — via [Zernio](https://zernio.com), a unified messaging API: one webhook (`message.received`) and one reply endpoint cover the first four; SMS/MMS rides the same model via a Zernio-provisioned phone number. **Snapchat has no messaging API on any provider**, Zernio included, so it isn't supported here.
  - One Zernio "profile" (workspace) is created per ScamShield user (`src/lib/supabase/channels.ts`), so each user's connected accounts are isolated
  - OAuth connect flow: `GET /api/zernio/connect?platform=X` → Zernio's hosted auth UI → `GET /api/zernio/callback` persists the connection
  - SMS numbers are **synced, not purchased** here — buying a number involves carrier KYC and is done directly in the Zernio dashboard; `/settings/channels` just registers whatever's already active on the user's profile
  - `POST /api/webhooks/zernio` verifies `X-Zernio-Signature` (HMAC-SHA256) before touching the payload
- **Slack** — a direct integration (no Zernio involvement): connect via `GET /api/slack/connect` (Slack's own OAuth), `POST /api/webhooks/slack` handles the Events API (`message.im`), verifying `X-Slack-Signature` and deferring the actual analysis to `next/server`'s `after()` so Slack's aggressive ~3s retry window is never at risk. Each connection is scoped to one Slack person in one workspace (not the whole workspace), so other members' DMs to the bot aren't misattributed. The bot's token is stored in `channel_credentials`, a table with **no RLS policies at all** — not even the connecting user's own session can read it back.
- **Discord** — also direct, but architecturally different: Discord only delivers ordinary DMs to a bot over a persistent Gateway **websocket**, not an HTTP webhook, so it needs its own always-on process — **`npm run bot:discord`** (`scripts/discord-bot.ts`), run separately from `next dev`/`next build`/`next start` and hosted somewhere long-lived (a small VPS/Fly.io/Railway box, or your own always-on machine — it cannot run on Vercel serverless). Connecting mirrors the Telegram flow: generate a short code in `/settings/channels`, DM it to the bot (after inviting the bot to a shared server — Discord requires that before you can DM it at all).

Requires a public HTTPS URL for the Zernio and Slack webhooks and OAuth callbacks — `NEXT_PUBLIC_APP_URL` must point at a real deployment or a tunnel (ngrok) for local testing; it won't work against plain `localhost`. Register `<NEXT_PUBLIC_APP_URL>/api/webhooks/zernio` as the `message.received` webhook in the Zernio dashboard, and `<NEXT_PUBLIC_APP_URL>/api/webhooks/slack` as the Slack app's Events Request URL.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in the keys below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required env vars

| Variable | Where to get it | Required for |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — free tier, no card required | Text/job-offer/screenshot/URL analysis, chatbot, RAG embeddings |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API | Auth, saved history, dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API | Seeding/reading the RAG pattern library, the channel-webhook path |
| `ZERNIO_API_KEY` / `ZERNIO_WEBHOOK_SECRET` | [zernio.com](https://zernio.com) dashboard | Optional — connected channels (WhatsApp/Instagram/Facebook/Telegram/SMS) |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | [api.slack.com/apps](https://api.slack.com/apps) | Optional — connected Slack channel |
| `DISCORD_BOT_TOKEN` / `DISCORD_BOT_INVITE_URL` | [discord.com/developers/applications](https://discord.com/developers/applications) | Optional — connected Discord channel (also requires running `npm run bot:discord` separately) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | [console.upstash.com](https://console.upstash.com) | Optional — exact-match analysis caching |
| `UPSTASH_VECTOR_REST_URL` / `UPSTASH_VECTOR_REST_TOKEN` | [console.upstash.com](https://console.upstash.com) — create the index with dimension 768, cosine similarity | Optional — semantic (near-duplicate) analysis caching |

The app degrades gracefully without Supabase configured — analysis still works, it just isn't saved and history/dashboard show an empty state. Without `GEMINI_API_KEY`, analysis endpoints return a clear 500 error rather than crashing. Without the `ZERNIO_*` vars, `/settings/channels`'s Zernio-backed buttons and the Zernio webhook route error; without the `SLACK_*`/`DISCORD_*` vars, their respective buttons/routes error — nothing else in the app is affected either way.

### Database setup

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates all tables, RLS policies, the `pgvector` extension/index, and the `match_scam_patterns` similarity RPC.

To seed the RAG pattern library with example scams:

```bash
npm run seed:patterns
```

## Testing

```bash
npm test          # unit tests (rule engine, scoring math, webhook signature checks)
npm run test:e2e  # Playwright end-to-end (requires a Playwright-supported OS/CI runner)
npm run bot:discord # the separate, always-on Discord Gateway process (see above) — not part of next dev/build/start
```

## Project structure

```
src/
  app/
    page.tsx            # main analyzer (text / job offer / screenshot / URL tabs)
    history/            # per-user analysis history
    dashboard/          # risk-level & category charts
    inbox/              # unified conversation view (Zernio channels + Slack/Discord)
    login/              # Supabase email + Google auth
    settings/channels/  # connect WhatsApp/Instagram/Facebook/Telegram/SMS/Slack/Discord
    api/
      analyze/          # text/job-offer analysis
      ocr/              # screenshot → OCR → analysis
      url-scan/         # URL technical checks + analysis
      chat/             # follow-up Q&A about an analysis
      history/ stats/   # read/delete history, dashboard aggregates
      zernio/           # OAuth connect/callback, channel list, SMS number sync
      slack/            # OAuth connect/callback
      discord/          # link-code connect/status
      channels/         # Slack/Discord conversation list + thread view (inbox backend)
      webhooks/zernio/  # inbound message.received handler
      webhooks/slack/   # inbound Events API handler

  components/
    ui/                 # shadcn/ui primitives (button, card, dialog, ...)
    layout/             # AppShell, Sidebar
    dashboard/          # DashboardCharts
    analysis/           # MessageInput, ScreenshotUpload, URLAnalyzer, AnalysisResultCard,
                         # RiskScore, RiskFactors, Recommendations, Chatbot

  lib/
    ai/                 # Gemini client, prompts, classifiers, embeddings
    scam/               # rule engine, scoring math, categories, pipeline
    url/                # URL metadata fetcher + analyzer
    ocr/                # Tesseract.js wrapper
    rag/                # pgvector retrieval + pattern comparison
    cache/              # Upstash exact + semantic analysis caching
    channels/           # shared cross-platform pipeline (handleInboundChannelMessage)
    zernio/             # Zernio API client, webhook signature check, message pipeline
    slack/              # Slack API client, webhook signature check, history
    discord/            # Discord REST client, link-code flow
    supabase/           # browser/server/service clients, history, stats, channels, credentials

  types/                # shared TS types (analysis.ts)
  proxy.ts              # Supabase session refresh (Next.js proxy, formerly middleware)

supabase/schema.sql   # full DB schema + RLS + RAG RPC + connected_channels/channel_messages/channel_credentials/discord_link_codes
scripts/
  seed-patterns.ts
  discord-bot.ts      # the standalone Gateway process — run separately, see "Connected channels" above
```

## Analysis caching (Upstash)

`analyzeText`/`analyzeImage` (`src/lib/scam/pipeline.ts`) check a two-tier cache before running the Gemini + rule-engine + RAG pipeline, since the exact same scam template routinely gets pasted by many different people:

1. **Exact cache (Upstash Redis)** — the normalized message text is hashed and looked up directly. A byte-identical repeat is served in one Redis round trip.
2. **Semantic cache (Upstash Vector)** — on an exact miss, the message is embedded (reusing the same Gemini embedding model as the RAG pattern library, not Upstash's built-in text-embedding mode) and checked against previously cached messages by cosine similarity. A near-duplicate (same scam, different phone number/name/amount) above `SEMANTIC_CACHE_SIMILARITY_THRESHOLD` reuses that result.

The cache is keyed on message text alone, not `input_type` — `classifyMessage`/`runRuleEngine` don't take input type into account, so the same text scores identically whether it came in through the "Message" tab, the "Job Offer" tab, or a connected channel; a cache hit is simply re-labeled with the current call's `input_type`/`input_text` before being returned. Entirely optional: without the `UPSTASH_*` env vars, both lookups no-op and every analysis runs uncached, same as before this existed.

## Notes on the AI guardrails

Every prompt in `src/lib/ai/prompts.ts` explicitly instructs the model not to invent facts, not to claim it "visited" a URL unless real fetch metadata is provided, and not to declare something "100% a scam" without strong evidence — the UI reflects uncertainty (e.g. OCR confidence warnings) rather than hiding it.
=======
# ScamShield-AI
>>>>>>> a0b1fa75f39ccecc2609efd1dc6ecf1bdb66113d
