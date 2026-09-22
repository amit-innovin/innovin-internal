# Innovin Internal — Workplace Utilities

> Simple tools for everyday needs. Built for our team.

Ideated from an internal product discussion + design exploration ([docs/design-options.jpg](docs/design-options.jpg)).

## Vision

A lightweight internal "office assistant" web app — small day-to-day utilities the team actually uses every day. Start small, ship quietly, iterate on real feedback. Not a big system, not a Zoho replacement.

## Product decisions (from the discussion)

- **Web app, mobile-friendly, installable as a PWA** — lives as a pinned browser tab like Zoho. NOT a Chrome extension (store review + fee + not everyone uses Chrome) and NOT a native app (distribution hassle, especially iOS).
- **No real authentication.** Attendance identifies a person by email entry only. Everything else is effectively anonymous.
- **Grievances are anonymous by design.** Identity is never exposed in the UI; the backend keeps only a private submitter reference for abuse tracing, visible to 1–2 admins and nowhere else.
- **Rollout discipline:** build quietly with a small team, reveal only in a common/demo meeting. Don't announce or gather big requirements upfront — past tools died that way.
- **Scope discipline:** no integrations, no futuristic features. Day-to-day utilities only.

## v1 modules

### 1. Attendance
- Check in / check out with timestamp + office tag
- Daily summary (who's in today), personal history
- Identity = email field only — no passwords, no accounts
- Optional later: auto-suggest check-in when on office Wi-Fi (IP/network signal)

### 2. Snacks & Tea
- Morning order flow: item (Tea / Snacks / Healthy option), preference, special instructions
- Orders close at a cutoff (~11:00 AM); consolidated daily list for whoever buys
- Admin manages items, prices, and availability from the backend based on nearby options
- Misuse protection: light rate-limiting on a private submitter ref (never shown)

### 3. Daily Grievances
- Free-text issues/suggestions; user picks **Anonymous** or **With name**
- Anonymous entries never display identity anywhere; backend stores a private submitter ref solely for abuse audit
- Admin view: inbox, status (open / in progress / resolved), summary report

### 4. Wi-Fi Quality
- Report Good / Poor + optional note; optional client-side speed test
- Recent reports feed makes patterns visible — if nobody flags it, everyone assumes it's fine

## Admin dashboard

Single view: today's attendance, consolidated snack orders, grievance inbox, Wi-Fi report feed. v1 access via a protected route + env-configured passcode.

## Suggested stack

- **Next.js + TypeScript + Tailwind** — deploys free on Vercel (account already configured for this repo)
- **Postgres** (Neon / Vercel Postgres free tier) + Drizzle or Prisma
- **PWA manifest** for install-to-homescreen
- Speed test: client-side fetch-based measurement (manual entry acceptable for v1)

## Data model (v1 sketch)

```
attendance    id · email · date · check_in_at · check_out_at · network_hint
snack_orders  id · date · item_id · preference · instructions · submitter_ref · created_at
menu_items    id · name · price · category · available
grievances    id · body · display_name(nullable) · submitter_ref · status · created_at
wifi_reports  id · quality · note · down_mbps · up_mbps · created_at
```

`submitter_ref` = hashed identifier stored server-side only, never returned to clients.

## Open questions

- Dashboard layout — Option 1 (all-in-one hub) vs Option 3 (dashboard with insights)? Leaning Option 1 for v1.
- Who is the admin/"buyer" for consolidated snack orders?
- Attendance: manual check-in only for v1, or attempt office-Wi-Fi detection now? (Needs the office's static IP or BSSID.)
- Grievance `submitter_ref`: hashed IP, optional email, or nothing? Decide how traceable is "traceable enough."
- Cutoff time for snack orders — hard cutoff or soft?

## Explicitly out of v1

Leave/approvals, asset management, compliance tooling, notifications/alerts, Chrome extension, native apps, any integrations.
