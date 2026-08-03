# rk.ai (claude-clone)

A Claude-style AI chat application.

## Stack

- Frontend: React (`frontend/`)
- Backend: Node / Express (`backend/`)
- Database: PostgreSQL via Prisma, with pgvector for semantic search
- Payments: Razorpay
- Deployment: Render (`render.yaml`); `docker-compose.yml` for local dev
- AI: Anthropic Messages API

## Backend layout (`backend/src/`)

- `server.js` — app entry point
- `keepalive.js` — keeps the Render service warm
- `config/` — configuration
- `lib/` — shared helpers, including `sse.js` (exports `send`, `startSSE`)
- `middleware/` — Express middleware
- `models/` — includes `STATIC_MODELS`, the Claude model list
- `providers/` — AI provider integration
- `services/` — business logic, including memory injection
- `routes/`
  - `chat.js` — chat endpoint, system prompt, history, current-date
    injection, knowledge cache
  - `auth.js` — authentication (Google OAuth)
  - `conversations.js` — conversation list and CRUD
  - `projects.js` — projects feature
  - `models.js` — Claude model auto-sync
  - `payment.js` — Razorpay
  - `admin.js`, `support.js`

## Database (`backend/prisma/`)

- `schema.prisma` — Prisma schema
- `migrations/` — migration history
- The knowledge cache uses pgvector semantic vector search

## Known issues

- The knowledge cache historically ran only on the first message of a
  conversation and was skipped from message 2 onward. Verify current
  behaviour before changing it.

## Rules for changes

- Never commit API keys, tokens, or `.env` contents.
- Never weaken authentication or allow one user to read another user's
  conversations.
- Never modify `payment.js` or Razorpay logic without explicit
  instruction.
- Never run Prisma migrations. Propose them and let a human run them.
- Do not change the system prompt without flagging it clearly in the PR
  description — it changes product behaviour.
- No new npm dependencies unless there is no reasonable alternative.
  Explain why in the PR.
- Keep changes small. One issue, one focused PR.
- Match existing code style. Do not introduce a styling framework.

## Always needs a human

Auth, payments, rate limits, Prisma migrations, and the system prompt.
