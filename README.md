# Income Tracker

Receives bank notification text (SMS / push) via webhook, parses incoming transfers, stores them in Postgres, and shows totals and counts (today / this month / all time, Asia/Bangkok time).

## Stack

Next.js 16 (App Router) · TypeScript · Neon Postgres (`@neondatabase/serverless`) · Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and WEBHOOK_SECRET (`openssl rand -hex 32`)
npm run db:migrate           # create tables (idempotent)
npm run dev                  # http://localhost:3010
```

| Env | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `WEBHOOK_SECRET` | yes | Shared secret for `/api/*` |
| `DASHBOARD_PASSWORD` | no | Enables HTTP Basic Auth on the dashboard (user `admin`) |

## Deploy (Vercel + Neon)

1. Import the GitHub repo at vercel.com/new.
2. Project → Storage → add **Neon** (sets `DATABASE_URL` automatically).
3. Project → Settings → Environment Variables: add `WEBHOOK_SECRET` and `DASHBOARD_PASSWORD`.
4. Redeploy. The `vercel-build` script runs `db:migrate` before `next build`, so tables are created on every deploy.

## Webhook

`POST /api/webhook` with `Authorization: Bearer <WEBHOOK_SECRET>` (or `X-Webhook-Secret`).

```bash
curl -X POST http://localhost:3010/api/webhook \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"รับโอนจาก X-5678 1,500.00 คงเหลือ 12,345.67 บ.","source":"KBank"}'
```

Body: `{ text: string, source?: string, receivedAt?: number | ISO string }`.
A `text/plain` body also works (source via `X-Source` header).

Each notification is stored with a status:

- `income` — incoming money with a parsed amount (counted in totals)
- `ignored` — outgoing (withdraw / transfer out / payment)
- `unparsed` — no amount or direction detected (kept for review)

The same text received again within 10 minutes is treated as a duplicate and not stored.

`GET /api/stats` (same auth) returns the totals as JSON. Amounts are in satang (`150000` = ฿1,500.00).

## Forwarding notifications from a phone

- **Android** — MacroDroid / Tasker: trigger on *Notification received* (bank app) or *SMS received*, action *HTTP Request* POST to the webhook with the notification text as `text`.
- **iOS** — Shortcuts → Automation → *Message* (from the bank's SMS sender) → *Get Contents of URL* (POST, JSON, header `Authorization`). iOS cannot read push notifications of other apps, so use bank SMS alerts.

Point the automation at `https://<your-app>.vercel.app/api/webhook`.

## Tests

```bash
npm test        # parser unit tests
npm run typecheck
```

Add a real notification from your bank to `src/lib/parser.test.ts` if it is parsed incorrectly, then extend the keywords in `src/lib/parser.ts`.
