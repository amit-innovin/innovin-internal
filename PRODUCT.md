# Innovin Internal — Workplace Utilities

> Simple tools for everyday needs. Built for our team.

Ideated from an internal product discussion + design exploration ([docs/design-options.jpg](docs/design-options.jpg)).

## Vision

A lightweight internal "office assistant" web app — small day-to-day utilities the team actually uses every day. Start small, ship quietly, iterate on real feedback. Not a big system, not a Zoho replacement.

## MVP goal

Validate that one lightweight internal tool can reliably replace four recurring manual office interactions: attendance count, snack collection, grievance reporting, and Wi-Fi issue visibility.

The MVP is successful when the team can use these four flows for one working week without parallel WhatsApp/manual collection, the office coordinator can act from the admin dashboard, and no anonymous submitter identity is exposed to users or admins.

## MVP acceptance criteria

- Attendance accepts only configured company email domains and exposes only the daily count publicly.
- Each browser can place, update, or cancel one order (any mix of items) per day; ordering is open all day unless `ORDER_CUTOFF_HOUR` sets a deadline.
- Anyone can submit a named or anonymous grievance with an optional photo; only an authenticated admin can read and resolve it.
- Attendance supports multiple check-in/check-out sessions per day and reports total time.
- Wi-Fi quality reports are immediately visible as a recent trend.
- Data persists in Postgres when deployed; local development works without external services.
- Admin and anonymous-device cookies are HTTP-only; private submitter references never appear in API responses.

## Product decisions (from the discussion)

- **Web app, mobile-friendly, PWA later** — lives as a pinned browser tab like Zoho. NOT a Chrome extension (store review + fee + not everyone uses Chrome) and NOT a native app (distribution hassle, especially iOS).
- **No employee authentication in the MVP.** Attendance identifies a person by company email entry only. The admin dashboard is passcode-protected.
- **Grievances are anonymous by design.** Identity is never exposed in the UI or admin dashboard; the backend keeps only a one-way browser reference for basic abuse tracing.
- **Rollout discipline:** build quietly with a small team, reveal only in a common/demo meeting. Don't announce or gather big requirements upfront — past tools died that way.
- **Scope discipline:** no integrations, no futuristic features. Day-to-day utilities only.

## v1 modules

### 1. Attendance
- Check in / check out with timestamp — repeatable through the day (out for lunch, back in)
- Per-day session list and total time tracked; public daily headcount; details restricted to admin
- One-time geolocation on check-in tags each session In office / Working remotely / Location not shared (env-configured `OFFICE_*` geofence; denied permission never blocks check-in; raw coordinates are stored but never exposed via the API)
- Identity = company email field only — no passwords, no accounts
- Optional later: auto-suggest check-in when on office Wi-Fi

### 2. Meals & Snacks
- Order flow: pick any items (Tea / Snacks / Healthy / Lunch / Dinner), special instructions
- Open all day by default; optional daily cutoff via `ORDER_CUTOFF_HOUR`; consolidated list for whoever buys
- Admin manages items, prices, and availability from the backend based on nearby options
- One selection per browser per day using a private device reference (never shown); saving replaces it

### 3. Daily Grievances
- Free-text issues/suggestions with an optional photo (compressed on-device); user picks **Anonymous** or **With name**
- Anonymous entries never display identity anywhere; backend stores a private submitter ref solely for abuse audit
- Admin view: inbox, status (open / in progress / resolved), summary report

### 4. Wi-Fi Quality
- Report Good / Poor + optional note; optional client-side speed test
- Recent reports feed makes patterns visible — if nobody flags it, everyone assumes it's fine

## Admin dashboard

Single view: today's attendance, consolidated snack orders, grievance inbox, Wi-Fi report feed. v1 access via a protected route + env-configured passcode.

## Suggested stack

- **Next.js + TypeScript + Tailwind** — deploys free on Vercel (account already configured for this repo)
- **Postgres** (Supabase / Neon / Vercel-compatible Postgres) through the `pg` adapter
- Local JSON persistence when `DATABASE_URL` is unset
- PWA installability and automated speed tests are deferred until after MVP validation

## Data model (v1 sketch)

```
attendance  id · email · date · check_in_at · check_out_at · lat · lng · accuracy_m   (one row per session)
orders      id · date · item_id · preference · instructions · submitter_ref · created_at  (one row per item)
grievances  id · body · display_name(nullable) · image(nullable) · submitter_ref · status · created_at
wifi          id · quality · note · down_mbps · up_mbps · created_at
announcements id · title · body · tag · created_at
```

`submitter_ref` = hashed identifier stored server-side only, never returned to clients.

## Decided

- Dashboard layout: Option 3 (dashboard with insights), themed with the innovinlabs.com brand.
- Announcements added (admin-posted, shown on the home dashboard).
- "Your Grievances" on home shows only the device's own submissions, preserving anonymity.
- Snack cutoff configurable via `ORDER_CUTOFF_HOUR` (default 24 = open all day).

## Open questions

- Who is the admin/"buyer" for consolidated snack orders?
- Attendance: manual check-in only for the MVP; office-Wi-Fi detection can be evaluated after usage validation.

## Explicitly out of v1

Leave/approvals, asset management, compliance tooling, notifications/alerts, Chrome extension, native apps, any integrations.
