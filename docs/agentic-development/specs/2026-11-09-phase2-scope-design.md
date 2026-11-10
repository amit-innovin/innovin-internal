# Phase 2: Scope, daily flow and PWA — design

Status: approved by the owner 2026-11-09; amended 2026-11-10 (see "Amendments") · · builds on Phase 1 (`admin-member-roles`: two roles, `requireUser`/`requireAdmin`, `(member)`/`(admin)` route groups, `proxy.ts`).

## Why

Innovin Internal was built feature-first and grew a lot of things nobody asked for. In real life the office runs on three habits that today happen by hand or over Slack:

1. **Arrive, mark attendance.**
2. **Tea once a day**, and snacks kept in stock in the office.
3. **Leave/WFH and events**, whenever needed.

The office is about 45 people on a hybrid policy: **at least 8 office days a month**, usually on fixed weekdays (for example, some people come Mon + Wed, others Tue + Thu).

Phase 2 cuts the app down to those habits, adds the features this attendance policy needs, and makes it an installable PWA. **Amended 2026-11-10:** Phase 2 is built directly in the new design system (see "Amendments"); there is no separate restyle phase.

## Goals

- Doing the daily habits takes seconds: one tap for attendance and one for tea, from Home.
- Everyone can see their progress toward the 8-day minimum, and who is coming in.
- Snack stock reflects what people want, without anyone "owning" a snack.
- The app installs on phones and desktops and behaves like an app.

## Non-goals

- Native iOS/Android apps. Phase 2 ships as a PWA; a Capacitor wrapper (for automatic step counts and native push) comes later.
- Chat or messaging. Slack covers that.
- Desk or parking booking.
- Any Swiggy/Instamart integration. Swiggy's public MCP terms currently say third-party app development is not permitted, and production callbacks need Swiggy allowlisting.

## Anti-goals: it fails even if it works when…

- A snack suggestion can be traced to the person who made it, in the UI or any API response.
- Attendance needs more than one tap on a normal day.
- Private, non-work data creeps back in (personal plans were removed because employees won't put private things in a company app).
- Offline mode pretends something was saved when it wasn't.

## Decisions made by the owner

### Removed

| Feature | What goes |
|---|---|
| Meals & Snacks | `/snacks`: fixed menu, per-person requests, preparing/ready/delivered, cutoff |
| Employee Instamart shop | `/pantry`, the published catalog, employee baskets |
| Swiggy purchasing | `/admin/pantry`, `/api/pantry-provider*`, `lib/pantry/*` provider code, `PANTRY_*` env vars |
| Pings | `/api/pings`, ping sheet, People message button, ping notifications and push |
| Paper Notes | floating "Drop a Paper Note" button and the mobile "Note" tab |
| Personal plans | `/planner`, `/api/planner`, planner data shown on the ID card's flip side |
| People directory page | `/people`. "In today" moves to Home |
| Separate check-in/out | Check In / Check Out on Attendance. The Home tap is the attendance record |
| WFH requests | The WFH request type and its approval. Remote days are normal under the 8-day policy; tapping Remote is enough. **Leave keeps its request + approval workflow.** |

The data these features stored is no longer read. Drop or archive tables; see "Left to the builder".

### Kept

- **Notice Board:**
  - admin announcements
  - member sticky notes (quote / public feedback, optional anonymous, emoji reactions)
  - admin removal of notes
  - **new:** a note can carry **one photo plus text**
- **Attendance & Leave:** calendar, leave balances (Zoho snapshots), leave requests and approvals (WFH requests removed).
- **Events:** publish, edit, cancel, RSVP going count.
- **Digital ID card:** its flip side shows the person's attendance month and 8-day progress, with no personal plans.
- **10K Steps challenge**, **Speak Up** (anonymous grievances, unchanged), **Wi-Fi speed test and reports**, **Settings**, **Help**, **Notifications/Web Push**, **Admin**.

### New: daily flow on Home

1. **Attendance, one tap: In office / Remote.**
   - That choice is the day's attendance record.
   - It can be changed during the day. The last choice wins.
   - The optional location check may remain only as a hint ("looks like you're not at the office"). It never blocks or overrides the choice.
   - **Corrections (owner decision):**
     - A member can set or fix their own day for **today and the previous 7 days**.
     - Older days are fixed only by an admin.
     - **Every change is logged**: who changed it, when, and from what to what. Admins can see the log.
   - A member on approved leave for a day is shown as on leave. Tapping In office that day is still allowed and records the office day; the leave request is left as it is. This is the builder's call, flagged for the owner.
2. **Tea today? One tap**, one round per day.
   - The admin sees today's count and the names.
   - Only people marked In office today can tap it (builder's call).
   - No menu, no prices, no notes.
   - It can be toggled off again the same day.
   - It resets at IST midnight.
3. **In today:** who is in today and where (office/remote). This replaces the People page. People on approved leave are not listed.

### New: Snacks (suggest → options → interest → admin orders)

Snacks are bought in advance and kept in the office as shared stock. Nobody orders a snack for themselves, so quantities are always the admin's decision; that avoids "I asked for one, someone else ate it".

The page has two parts, both **always open** (no rounds):

1. **Suggestions**
   - Any member suggests a snack (short text, e.g. "Roasted peanuts").
   - Any member can **+1** a suggestion, once per person, and can take it back.
   - The suggester counts as the first +1 (builder's call).
   - When someone types something close to an existing open suggestion, offer to +1 that instead.
2. **Options**
   - The admin promotes popular suggestions, or adds items directly, as **available options**. An option has a name and an optional Instamart link.
   - Members tap **"I'd like this"** on any option to register interest. It's one tap with no quantity, and can be taken back.
   - The admin sees a **consolidated list** of options sorted by interest count (e.g. "Peanuts — 9, Marie biscuits — 6"), decides quantities, and **orders manually on Instamart**.
   - When the admin marks an option **Ordered/Restocked**, its interest count resets, and it stays available for the next restock.
   - The admin can retire options and suggestions, or merge duplicates.

**Anonymity (owner decision):** suggestions, +1s and interest are anonymous. No name appears in the UI or in any API response, admins included. The server stores who voted only to prevent double counting.

The app does not track stock levels and does not talk to Instamart.

### New: 8-day office tracker

- Monthly target: **8 office days**, configurable via env with default 8.
- **Who counts (owner decision):** everyone, admins included.
  - An admin can mark a person **exempt** (fully remote, contractor). The person is then excluded from the target and the below-target list.
  - Someone who joins mid-month gets a **pro-rated** target for that month: 8 × (working days from joining ÷ working days in the month), rounded up.
- Only days marked **In office** count. **Leave and holidays do not reduce the target.** Leave days must be made up (owner decision).
- A day marked In office on a weekend or holiday counts (builder's call).
- **Existing data (builder's call):** check-in rows from before this change count as office days when they were tagged In office (declared mode, or the location/Wi-Fi tag), ignoring check-out times. Nobody is shown short for days they really came in during the release month.
- Home and the ID card show "5 of 8 office days this month" and how many working days remain.
- Admins get a month view of everyone's office-day count, highlighting those below target. They can also export it as **CSV**.

### New: Office days schedule

- Each member sets their **regular office weekdays** once, in Settings or the first-run prompt (e.g. Mon + Wed).
- Home shows **who's expected today and tomorrow**, with names and a count. This helps colleagues coordinate and gives admins a tea and snack headcount estimate.
- The 8-day tracker uses the schedule to say whether the person is on track ("on track if you keep Mon/Wed", or "you'll be 2 short").

### New: Swap a day

- A member can change one week's office days only, for example Thu instead of Wed.
- The swap affects that week's expected list and nothing else. The regular schedule is unchanged.
- **Builder's call:** a swap replaces that week's set of days (it can add or drop days, not only trade one for one), for the current or a future week only, on any working day.
- People on approved leave are left out of "expected" for those days.

### New: Birthdays and work anniversaries

- Show on the Notice Board / Home on the day.
- Work anniversaries come from the existing `joinedOn`.
- Birthday is a new **optional** field the member sets themselves (day and month only, never the year). A person can hide their birthday and their work anniversary.

### New: Breaks, water and the Friday recap

The owner wants the app to help people stay fit at work, not just track attendance. Everything here is **private to the person** unless stated otherwise. Health data never appears in another person's view, an admin view, or an API response about someone else.

**Water log**
- Home has a **+1 glass** tap. Lappy takes a sip.
- Personal daily goal: default 8 glasses (250 ml each), and each person can change it.
- Today's progress shows next to the tap. The history is visible only to its owner.

**Break reminder (one stream, not three)**
- It's a real break: **"Look away from the screen, stand up, grab some water."** Tapping the notification opens a short in-app break.
  - Lappy runs a ~20-second look-away and stretch with a countdown.
  - Then **Done** (logs a break) or **+1 glass**.
- Sent only when **all** of these are true:
  - the person is marked **In office** today
  - it's within their work hours (default 10:00–18:00 IST)
  - it's not quiet hours
  - they haven't logged a break in the current interval
- The interval defaults to **60 min**, with a choice of 45, 60 or 90, or off. Snooze is 15 min.
- Settings live on Settings → Breaks. Reminders are **opt-in**: the first time, the app explains them and asks for notification permission.
- Water logging and finishing a break both reset the timer, so nobody gets nagged right after they acted.

**Team hydration goal**
- An office-wide weekly target, for example 1,500 glasses, set by an admin (default: active people × 5 days × 6 glasses).
- Home shows a shared progress bar: "Office this week: 1,120 / 1,500 glasses".
- **Only the total is ever shown or returned.** There's no per-person breakdown, ranking or "who hasn't drunk".
- When the goal is hit, everyone gets a celebration with Lappy.

**Friday recap**
- Fridays at ~17:00 IST: a push ("Your week with Lappy") plus a recap card on Home until Monday.
- The card covers office days this month (battery), days in office this week, water this week vs goal, breaks taken, steps (if logged) and tea rounds joined. There's one upbeat line from Lappy, never a guilt trip.
- Private to the person, with the team hydration total as the one shared figure.

**How reminders get delivered (constraints)**
- These are server-sent Web Push notifications using the existing `lib/push.ts` (VAPID). A scheduled job runs every **15 minutes** during work hours and pushes to whoever is due. A browser app can't reliably schedule its own notifications.
- **Owner decision needed:** a 15-minute schedule needs either **Vercel Pro** cron or an external trigger. As far as we know, the Hobby plan only allows daily cron; confirm against the current plan. The external trigger would be a GitHub Actions `schedule` workflow calling a secret-protected endpoint.
- iPhone users get push only with the PWA **installed** (iOS 16.4+). Notification action buttons (+1 glass) work on Android and desktop Chrome, not iOS, where the tap opens the app instead.
- If push is unavailable, the in-app break card and water tap still work.

**Anti-goals for this feature**
- No shaming, streak-loss guilt or public individual health numbers.
- A person who never opts in gets no reminders and no recap pushes, and the app works the same for them.

### Navigation

- **Main nav** (desktop top bar; mobile bottom bar has the same five): **Home · Attendance & Leave · Snacks · Events · Speak Up**
- **More:** Notice board · 10K Steps · Wi-Fi · Settings (incl. Breaks) · Help · Admin (admins only)
- The prototype on the design canvas (https://claude.ai/artifact/DEsTmRtTRB5vP2G5ugddyE) labels Attendance & Leave as **Days**.
- `/leave`, `/away` keep redirecting to Attendance & Leave. Removed routes 404 or redirect Home (builder's call).

### PWA

- Register the service worker for **everyone** on load, not only when push is enabled. Keep the existing push handling.
- Manifest: proper name, `id`, maskable 192/512 icons, theme colours from the current brand. Add **shortcuts**: "Mark attendance" and "Tea today".
- **Offline:**
  - Cache the app shell and static assets so the app opens offline.
  - Show a clear "You're offline" state.
  - **Do not queue writes.** Attendance, tea, suggestions and the rest require a connection, and the UI says so (anti-goal: never pretend something was saved).
- Install guidance:
  - an "Install app" prompt where the browser supports it
  - a one-time "Add to Home Screen" hint on iOS Safari
- The service worker must never cache authenticated API responses or HTML containing personal data in a way another account on the same device could read. Bypass the cache for `/api/*` and sign-in.

## Constraints

- Everything from Phase 1 holds:
  - two roles
  - members never see admin UI
  - every API checks its own access
  - Speak Up stays anonymous and usable signed out
- `AGENTS.md` conventions:
  - Store changes go in both `jsonstore` and `pgstore`, with contract tests
  - client calls go through `lib/fetcher.ts`
  - OAuth links are plain `<a>`
  - dependencies are pinned and at least 7 days old
- Photos use the existing client-side compression (`lib/image.ts`, data URL ≤ ~600 KB). There is no file-storage service.
- Times and days are IST (`lib/time.ts`). Working days and holidays use the existing leave rules (`lib/leave.ts`).
- Phase 2 UI is built in the Duo Pop design system (see "Amendments") and must not add to the legacy template CSS (`app/reference.css` etc.); legacy CSS is deleted as screens are rebuilt.

## Left to the builder

- Data migration: whether to drop or keep (unused) the tables for removed features. Production is Postgres, so pick a safe approach.
  - **Decided (PR 1): keep.** `orders`, `pings`, `planner_days` and `provider_records` stay in Postgres with their rows; the app no longer creates or reads them and no app code drops them. Pre-cut WFH rows stay in `away` (owner history only). Archiving or dropping is a separate, deliberate operation later, if ever.
- Whether removed URLs 404 or redirect Home.
  - **Decided (PR 1): redirect Home.** `/pantry`, `/snacks`, `/planner`, `/people` and `/admin/pantry` redirect to `/` with a temporary 307 (`next.config.ts` `redirects()`), never a 404 — `/snacks` returns in PR 4 as "Tea & snacks", and a temporary redirect is not cached by browsers. Redirects run before the sign-in proxy, so a signed-out visitor reaches `/sign-in`. Next passes the old query string through (`/snacks?tab=today` → `/?tab=today`); Home ignores it. Removed API routes simply 404; `/api/people` stays.
- Fuzzy-match rule for duplicate suggestions.
- Exact copy, and how the ID card shows 8-day progress.
- Whether the location hint survives at all.
- How the notice photo renders: thumbnail with tap to enlarge, as Speak Up does.

## Amendments (owner, 2026-11-10)

The design canvas prototype is the visual and interaction reference: https://claude.ai/artifact/DEsTmRtTRB5vP2G5ugddyE (board "Full app prototype"; Lappy poses on "Lappy mascot reference").

**Design system: Duo Pop, built in Phase 2.**
- Tokens: primary #1cb0f6 (edge #1288c4, text-on #06283d), brand text #0a7fbf, hero navy #235390, gold #ffc800, lime #89e219 (edge #5fa80f), grape #ce82ff / #f6e3ff, pink #ffe3ea / #9b1b45, sky #ddf4ff / #84d8ff, ink #1f2a37, muted #4b5563, line #e5e7eb, soft #f3f4f6, white background. One palette only.
- Type: Fredoka (headings, buttons) + Nunito (body).
- **Affordance rule:** anything tappable has a chunky solid bottom edge (3–5px) and presses down on tap; information is flat (border only, or a soft blurred shadow for paper-like notes). Nothing informational may look like a button.
- Mascot **Lappy** (laptop), one character with poses: idle wave, office tick, tea cheer, fully charged, jogging, reading. Motion respects reduced-motion.

**Navigation (replaces the "Navigation" section above).**
- Bottom bar (mobile) and top bar (desktop): **Home · Days · Snacks · Speak up · Settings**. No "More" page, no Events tab.
- Home links to: Wi-Fi check (header icon), notifications (bell), Notice board ("Open board ›"), 10K steps and Reading list (two tiles). Sub-pages have a back arrow.
- Admin is reached from Settings (admins only).

**Home order:** greeting + Lappy line → "I'm in the office" (big) → "Working remote today" (slim) → tiles: 10K steps (rank this week, today's count) and Reading list (current book, %) → Notice board peek (pinned announcement, next event, today's birthday) → "Office days this month · N of 8" battery (8 bars) with "X more to hit your 8 by <last day>" → flat "Who's around" (in today, expected tomorrow). The word "battery" is not shown to users; "FULLY CHARGED!" is the 8/8 celebration.

**Tea moves to the Snacks page**, renamed "Tea & snacks": a chai card on top (Lappy, today's count, "Count me in" / "You're in"), snack shelf below. The tea rules above are unchanged.

**Events live on the Notice board** (an "Events" filter, inline "I'm in" RSVP, tap for details; back returns to the board). Event publishing/editing stays admin-only.

**10K steps becomes a league:** today's ring and logging on top; a "Step league" with Week/Today tabs, a top-3 podium (crown on 1st), a nudge ("Pass Ravi with N more steps"), and ranks 4+ as a list with the viewer highlighted. Steps stay manually logged in the PWA.

**New: Reading list.**
- "Reading now" card with Lappy reading: title, author, page progress, "+pages" and "Finished it!".
- Finishing shows "BOOK FINISHED!" and counts books this year; then "Between books" until the person starts another.
- Team shelf: books with "N read it · M want to read", a "Want to read" toggle, and "Start" when between books.
- "Recommend a book" adds to the shelf. Reading activity is visible to colleagues only as counts on the shelf, never as a per-person list.

**Delivery plan (one PR each, stacked):** 1 Cut removed features · 2 Design system, shell and PWA · 3 Attendance core and Home · 4 Tea & snacks · 5 Notice board, events and celebrations · 6 Steps league, reading list, Wi-Fi, Speak up and Settings in the new design · 7 Wellness (water, breaks, team hydration, Friday recap; reminders triggered by a GitHub Actions schedule every 15 minutes).
