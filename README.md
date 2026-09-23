# Innovin Internal

Simple tools for everyday needs. Built for our team. See [PRODUCT.md](PRODUCT.md) for the product spec.

## Modules

- **Attendance** — check in/out with your company email as often as you step out and back; sessions and total time tracked per day; one-time browser location on check-in tags each session In office / Working remotely / Location not shared (configurable `OFFICE_*` geofence); email remembered per device
- **Meals & Snacks** — pick any items (tea, snacks, lunch, dinner) once per device per day, changeable/cancellable all day (optional `ORDER_CUTOFF_HOUR` deadline); consolidated list for the coordinator
- **Daily Grievances** — anonymous or named, with an optional photo; submitters track status via ids held on their own device; the database stores no device link at all, so anonymous submissions can't be traced even with direct DB access
- **Speed test** — Check Speed downloads from fast.com's nearest Netflix CDN node (looked up by an edge function, since api.fast.com allows no browser CORS and picks nodes by caller location) and times it **from the first byte**, so connection latency isn't counted as transfer time. Stops at 12 MB or 8 seconds. Falls back to a self-hosted 2 MB payload if fast.com is unavailable; `SPEEDTEST_PROVIDER=self` disables it.
- **Wi-Fi Quality** — speed test + Good/Poor reports with notes and a recent feed
- **Time Away** (`/away`) — leave and work-from-home requests: pick dates, submit, track approval status on your own device; admins approve/reject on the dashboard. Signed-in devices submit under their verified email.
- **Attendance calendar** — a month grid inside Attendance with one dot per day (present / leave / WFH / holiday / weekly off); tap a day for its check-in sessions, locations and durations. Upcoming holidays sit below it.
- **Leave** (Attendance → Leave tab) — balances per leave type (Casual, Sick, Earned, Flexible) under Employee Leave Policy 3.0, plus the declared-holiday calendar. Leave is charged in **working days**: Sundays, the 2nd and 4th Saturday, and declared holidays are free. Half-day Casual Leave is supported; Earned Leave accrues 1.25 days per completed month and can't be availed in the first year. Balances are per verified identity, so signing in is required — requesting time away still works unsigned. Admins see everyone's remaining days and set joining dates on the dashboard. 2026 opening balances were imported from the team's spreadsheet (`data/leave-2026.json`). `/leave` and `/away` redirect here.
- **Events** (`/events`) — upcoming internal events (matches, workshops, celebrations, town halls) published by admins; one-tap RSVP per device showing only a going count — never a guest list.
- **People** (`/people`) — the office directory: everyone who's signed in (Google name/photo/email), plus "In today" — who's checked in right now with an In office / Remote tag.
- **Announcements** — posted by admins, shown on everyone's home dashboard
- **Admin** (`/admin`) — dashboard: attendance (with real names + location tags), orders, grievance inbox with statuses, Wi-Fi feed, time-away approvals, announcements
- **Roles** — `owner` > `admin` > `member`. Owners are set via `OWNER_EMAILS` and grant/revoke admin from the dashboard's Access card; admins reach the dashboard by signing in with Google, so approvals are recorded against their name. `ADMIN_PASSCODE` remains as break-glass access (bootstrap, or if Google sign-in is unavailable) and is deliberately unattributed.
- **Sign in with Google** — optional verified identity on `innovinlabs.com`; a signed-in device can't mark attendance for a different email, and admins see real names. Works without it too.

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
| `ADMIN_PASSCODE` | Break-glass access to `/admin`. 4–8 digits → PIN pad, otherwise password field. Unset → passcode entry locked (role-based sign-in still works). **Use a long, unique value in production.** |
| `OWNER_EMAILS` | Comma-separated emails granted the `owner` role on Google sign-in. Owners grant/revoke admin in-app; an owner's own role can only be changed here. |
| `DATABASE_URL` | Postgres (Supabase/Neon/any). Required when deployed — the app refuses the file store on Vercel. |
| `DATABASE_CA_CERT` / `DATABASE_SSL_VERIFY` | TLS verification for remote Postgres (default: encrypted, unverified — see `lib/pgconfig.ts`). |
| `DATABASE_POOL_MAX` | Connections per serverless instance (default 5). |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to mark attendance (default `innovinlabs.com`). |
| `ORDER_CUTOFF_HOUR` | IST hour (0–24) when orders close (default 24 = open all day). |
| `OFFICE_LAT` / `OFFICE_LNG` / `OFFICE_RADIUS_M` | Office geofence for attendance tagging (radius in metres, default 300). Unset → check-ins show "Location not shared". |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth "Web application" credentials (redirect URI `<app-url>/api/auth/callback`). Unset → sign-in hidden, attendance stays email-typed. |
| `SESSION_SECRET` | Signing key for 30-day employee sessions (falls back to `ADMIN_PASSCODE`). |

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
- Attendance allows typed-email check-in without an account (MVP decision); a Google sign-in overrides the typed email so signed-in devices can't spoof identity. Employee sessions are HMAC-signed, HttpOnly, SameSite=Lax, 30 days, and invalidate when `SESSION_SECRET`/`ADMIN_PASSCODE` changes.
- Check-in location is captured once per session (no tracking); the API returns only the office/remote/unknown tag, never raw coordinates. Employees can deny the browser permission — attendance still works, tagged "Location not shared".
- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS are set in `next.config.ts`.

## Deploy (Vercel)

1. Create a Postgres database (Supabase: use the pooled connection string).
2. In the Vercel project set `DATABASE_URL`, a strong `ADMIN_PASSCODE`, `OFFICE_LAT`/`OFFICE_LNG`/`OFFICE_RADIUS_M` for attendance tagging, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for sign-in, and optionally `ALLOWED_EMAIL_DOMAINS` / `ORDER_CUTOFF_HOUR` / `SESSION_SECRET`.
3. `vercel link --token "$VERCEL_TOKEN"` then `vercel deploy --token "$VERCEL_TOKEN"`.
