# Innovin Internal

Simple tools for everyday needs. Built for our team. See [PRODUCT.md](PRODUCT.md) for the product spec.

## Modules

- **Attendance** — check in/out with your `@innovinlabs.com` email
- **Snacks & Tea** — morning orders, consolidated daily list (orders close 11 AM IST)
- **Daily Grievances** — anonymous or named; identity never exposed in the UI
- **Wi-Fi Quality** — good/poor reports + notes with a recent feed
- **Admin** (`/admin`) — consolidated dashboard, passcode-gated

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Configuration (`.env`)

| Var | Purpose |
|---|---|
| `ADMIN_PASSCODE` | Enables `/admin` — unset means admin is locked |
| `DATABASE_URL` | Postgres connection (Neon/Supabase/Vercel PG). Unset → local `data/store.json` |
| `ALLOWED_EMAIL_DOMAINS` | Domains allowed to mark attendance (default `innovinlabs.com`) |
| `VERCEL_TOKEN` | For deploy commands (never commit) |

## Deploy

`vercel link --token "$VERCEL_TOKEN"` then `vercel deploy --token "$VERCEL_TOKEN"`. Set `DATABASE_URL` (Postgres) and `ADMIN_PASSCODE` in project env — the JSON file store does not survive serverless.
