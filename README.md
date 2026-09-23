# Innovin Internal

Simple tools for everyday needs. Built for our team. See [PRODUCT.md](PRODUCT.md) for the product spec.

## Modules

- **Attendance** — check in/out with your company email as often as you step out and back; sessions and total time tracked per day; one-time browser location on check-in tags each session In office / Working remotely / Location not shared (configurable `OFFICE_*` geofence); email remembered per device
- **Meals & Snacks** — pick any items (tea, snacks, lunch, dinner) once per device per day, changeable/cancellable all day (optional `ORDER_CUTOFF_HOUR` deadline); consolidated list for the coordinator
- **Daily Grievances** — anonymous or named, with an optional photo; submitters track status on their own device; identity never exposed, not even to admins
- **Wi-Fi Quality** — speed test + Good/Poor reports with notes and a recent feed
- **Announcements** — posted by admins, shown on everyone's home dashboard
- **Admin** (`/admin`) — passcode-gated dashboard: attendance, orders, grievance inbox with statuses, Wi-Fi feed, announcements

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui · beUI + transitions.dev motion · Postgres via `pg` (JSON file for local dev) · Vitest · Playwright. Brand (Figtree, palette, cards, logo) follows innovinlabs.com.

## Run locally

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSCODE=1704 for local use
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL`, data is stored in `data/store.json` (git-ignored).

## Configuration

| Var | Purpose |
|---|---|
| `ADMIN_PASSCODE` | Enables `/admin`. 4–8 digits → PIN pad, otherwise password field. Unset → admin locked. **Use a long, unique value in production.** |
| `DATABASE_URL` | Postgres (Supabase/Neon/any). Required when deployed — the app refuses the file store on Vercel. |
| `DATABASE_CA_CERT` / `DATABASE_SSL_VERIFY` | TLS verification for remote Postgres (default: encrypted, unverified — see `lib/pgconfig.ts`). |
| `DATABASE_POOL_MAX` | Connections per serverless instance (default 5). |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to mark attendance (default `innovinlabs.com`). |
| `ORDER_CUTOFF_HOUR` | IST hour (0–24) when orders close (default 24 = open all day). |
| `OFFICE_LAT` / `OFFICE_LNG` / `OFFICE_RADIUS_M` | Office geofence for attendance tagging (radius in metres, default 300). Unset → check-ins show "Location not shared". |

Tables and indexes are created automatically on first use.

## Testing

```bash
npm run typecheck
npm test                                  # unit + JSON store contract
TEST_DATABASE_URL=postgres://… npm test   # + Postgres store contract
npm run test:e2e                          # production build + Playwright (desktop & mobile + API)
E2E_DATABASE_URL=postgres://… npm run test:e2e   # E2E against Postgres
```

Playwright uses its bundled Chromium (`npx playwright install chromium`); set `CHROME_PATH` to use a local Chromium-based browser instead. CI (`.github/workflows/ci.yml`) runs typecheck, unit + Postgres contract, `npm audit`, and E2E against both storage backends.

What's covered: every employee and admin flow in the browser (with console-error guard), the after-cutoff flow, horizontal overflow on all pages, and at the HTTP level validation, auth, privacy (no submitter identity leaks), idempotency, rate limits, and security headers.

## Security notes

- Admin sessions are HMAC-signed, expire server-side after 12h, and are invalidated when `ADMIN_PASSCODE` changes. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Failed admin logins are rate limited (5 per IP / 15 min, 50 globally); grievances, Wi-Fi reports and speed tests are limited per device and per IP. Limits are in-memory per instance — use a shared store (e.g. Redis) if strict global limits are ever needed.
- Rate limiting trusts `X-Forwarded-For`, which Vercel sets. Behind other proxies, make sure the proxy overwrites it.
- Attendance intentionally has no employee login (MVP decision): anyone can mark attendance for any allowed email.
- Check-in location is captured once per session (no tracking); the API returns only the office/remote/unknown tag, never raw coordinates. Employees can deny the browser permission — attendance still works, tagged "Location not shared".
- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS are set in `next.config.ts`.

## Deploy (Vercel)

1. Create a Postgres database (Supabase: use the pooled connection string).
2. In the Vercel project set `DATABASE_URL`, a strong `ADMIN_PASSCODE`, `OFFICE_LAT`/`OFFICE_LNG`/`OFFICE_RADIUS_M` for attendance tagging, and optionally `ALLOWED_EMAIL_DOMAINS` / `ORDER_CUTOFF_HOUR`.
3. `vercel link --token "$VERCEL_TOKEN"` then `vercel deploy --token "$VERCEL_TOKEN"`.
