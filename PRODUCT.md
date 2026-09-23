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
- **Google sign-in (Workspace) verifies identity** — a signed-in device can't mark attendance for a different email, and admins see real names. Typed-email check-in still works for anyone who hasn't signed in. The admin dashboard is passcode-protected.
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

Single view: today's attendance, consolidated snack orders, grievance inbox, Wi-Fi report feed.

**Access model.** Three roles on the employee record: `owner` > `admin` > `member` (the default on first sign-in). Owners come from `OWNER_EMAILS` and grant/revoke admin from the Access card; admins open the dashboard by signing in with Google, which makes their actions attributable ("Approved by …") and individually revocable. The original shared passcode is retained as deliberate break-glass access — it carries no identity, so anything done through it is recorded unattributed. Titles/teams are intentionally *not* modelled yet: when they arrive they'll be directory metadata only and must never imply permissions.

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
employees     email(pk) · name · picture · created_at · last_seen_at
away          id · email · type(leave|wfh) · start_date · end_date · reason · status(pending|approved|rejected) · submitter_ref · created_at
```

`submitter_ref` = hashed identifier stored server-side only, never returned to clients.

## Decided

- Dashboard layout: Option 3 (dashboard with insights), themed with the innovinlabs.com brand.
- Announcements added (admin-posted, shown on the home dashboard).
- "Your Grievances" shows only submissions whose ids the device carries in its cookie; the DB stores `submitter_ref = 'anon'` on every grievance (older rows scrubbed on migration) so anonymous feedback can't be traced even with direct database access.
- Snack cutoff configurable via `ORDER_CUTOFF_HOUR` (default 24 = open all day).

## Open questions

- Who is the admin/"buyer" for consolidated snack orders?
- Attendance: manual check-in only for the MVP; office-Wi-Fi detection can be evaluated after usage validation.

## Post-v1 additions

- **Time Away** (`/away`) — the first Request primitive. Leave and WFH requests in one lightweight flow: dates + optional reason → pending → approved/rejected by the admin. Employees track status on their own device; signed-in (Google) devices submit under their verified email. Deliberately minimal — no leave balances, no manager routing; Zoho remains the system of record.
- **Google sign-in** — verified `@innovinlabs.com` identity; attendance and away requests submitted under the verified email can't be spoofed; admins see real names.
- **Leave tracker** — annual leave balance (`LEAVE_ALLOWANCE_DAYS`, default 12 days): employees see used/pending/remaining on `/away` (verified email when signed in, this device otherwise); admins see a per-person usage table under Time away. Counts calendar days; WFH doesn't count; rejected requests don't count.
- **Events** (`/events`) — the second reusable primitive. One event model (title, category, start time, location, details) powers sports screenings, workshops, celebrations and town halls. Admins publish/delete from the dashboard; employees RSVP per device with a public going count only — the guest list is never exposed.
- **People** (`/people`) — the office directory: signed-in employees (Google name, photo, email, joined date) plus an "In today" presence list showing who's checked in with an In office / Remote / Location not shared tag — names and tags only, never raw coordinates.

## Explicitly out of v1

Leave balances/HRIS sync, asset management, compliance tooling, notifications/alerts, Chrome extension, native apps, any integrations.
