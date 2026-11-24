# Income Tracker

Receives bank notification text (SMS / push) via webhook, parses incoming transfers, stores them in SQLite, and shows totals and counts (today / this month / all time, Asia/Bangkok time).

## Stack

Next.js 16 (App Router) · TypeScript · `node:sqlite` (built into Node ≥ 22.13, no native deps)

## Setup

```bash
npm install
cp .env.example .env.local   # then set WEBHOOK_SECRET (e.g. `openssl rand -hex 32`)
npm run dev                  # http://localhost:3010
```

| Env | Required | Description |
| --- | --- | --- |
| `WEBHOOK_SECRET` | yes | Shared secret for `/api/*` |
| `DASHBOARD_PASSWORD` | no | Enables HTTP Basic Auth on the dashboard (user `admin`) |
| `DATABASE_PATH` | no | SQLite file, default `./data/income.db` |

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

The phone needs to reach the server: deploy it (VPS, Railway, Fly.io — anything with a persistent disk for SQLite) or expose it locally with a tunnel such as Cloudflare Tunnel / ngrok.

## Tests

```bash
npm test        # parser unit tests
npm run typecheck
```

Add a real notification from your bank to `src/lib/parser.test.ts` if it is parsed incorrectly, then extend the keywords in `src/lib/parser.ts`.
