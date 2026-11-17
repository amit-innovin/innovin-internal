# Days (Material 3, Stage 2) — design

Branch: `m3-foundation-home` (never merged to main). Prototype: `docs/design/m3/Prototype.dc.html` (mobile, "Days" tab) and `DesktopPrototype.dc.html` (desktop). Stage 1 plan: `docs/superpowers/plans/2026-11-18-m3-foundation-home.md`.

## Intent

The app exists mainly for employee welfare. Days is where a person looks after their own month: which days they'll come in, their leave, and fixing a day they forgot to mark. It helps them meet the office-day target without pressure, and never suggests a day because particular colleagues will be there (owner ruling: no groupism).

## Goals

1. Rebuild `/days` in Material 3, wrapped in `className="m3 m3-page"`, following the prototype:
   - Hero: the "days" `PageHero`, title "Days", subtitle "Tap a date to plan a day in, or to apply for leave".
   - Calendar card:
     - Month heading with previous/next month buttons, and the pace verdict chip (`paceVerdict` from `lib/pace.ts`).
     - "Leave left" chips per type (Casual, Sick, Earned, Flexible) with the line "Updated {date}".
     - When behind: "{N} weekdays left in {Month}, including today. Tap days below to plan them."
     - Tappable date grid and a short legend: Done, Planned, Leave only (owner ruling). Requested leave (dashed), closed days (greyed) and today (ring) are styled but not in the legend; their cell labels say what they are. Remote days aren't shown: not coming in means remote.
   - Day sheet (bottom sheet on mobile, dialog on desktop) for a future working day. Its title is the date and its status line says whether you're planned. It offers "Plan to come in" (or "Remove from my plan") and "Apply for leave".
   - Leave form inside the sheet:
     - Type chips, each showing what's left including pending; a type is disabled when less than 0.5 is left.
     - A Half day switch (Casual only, single day).
     - An optional "Until" date for multi-day leave.
     - Send request and Back.
   - "Coming up": horizontal cards of your next planned days (weekday + date, and "Your usual day" or "Added by you"), with **no faces or names**.
   - No "Still to plan" list (owner ruling): tapping a date on the calendar is how you add a day. When behind, the calendar line reads "… Tap a date to plan it."
2. Keep what today's page does that the prototype doesn't draw, restyled in M3:
   - fixing any of your own last 7 days with two choices, In office or Not in office (clears the day), and the "locked" explanation for older days;
   - your weekly office days (Mon–Fri chips);
   - your leave requests, with status and cancel.
3. Plan single dates on top of the weekly pattern. A date is planned if you added it, or if it matches your weekly days and you haven't removed it.
4. Closed days:
   - Admins can mark a date as office closed, with a reason.
   - A closed date is greyed out with a dashed border, can't be planned, is left out of "Coming up", and its reason shows in the cell's label.
   - Nobody is expected in on that day.
5. Home:
   - Rename "Your crowd today" to "In office today". It keeps its names and avatars.
   - **Remove "Working remote"** (owner ruling: not coming in means remote, so the mark has no purpose). Check in is the only action.
   - On a day you're planned in, the check-in card looks as it does today. On other days it shrinks to a quiet row: "Not planned in today", with "In the office after all?" and a Check in button.
   - Remove the remote-only states: the "Remote today" chip and the next-office-day card.
6. Remote as a mark goes away everywhere new:
   - `POST /api/days` stops accepting `mode: "remote"` for today (400).
   - The past-day fix offers office or clear.
   - Admin overview counts merge "Remote" into "Not in office".
   - Existing remote rows stay readable. They count as "not in office", and no data is migrated.

## Non-goals / anti-goals

- No suggestions based on who else will be in. No faces or names on Days.
- No Google Calendar sync (owner declined).
- Not sending leave to Zoho People yet. That is blocked on the live Zoho test and a new token (see memory: zoho-leave-via-api). Requests go through the existing `POST /api/away` as today. Until that lands, the sheet says "Your request goes for approval. You'll see its status here", not the prototype's "This goes to Zoho People".
- Closed days don't change the monthly target.

## Constraints

- Store changes go in both `lib/jsonstore.ts` and `lib/pgstore.ts`, plus `tests/store/contract.ts`.
- Any new dependency is pinned to an exact version at least 7 days old. None is expected.
- Push must never carry grievance content. This stage doesn't touch push.
- Uses the Stage 1 tokens and primitives (`components/m3`). No Duo components inside the page.
- Mobile first. Desktop follows `DesktopPrototype.dc.html`, where the day sheet is a centred dialog.

## Approaches considered

How a single-date plan is stored:

- **A. Overrides on the weekly pattern (chosen).** A row per (email, date) with `planned: true|false`. The weekly days stay the default; an override wins for its date. Nobody has to replan each week, and "Remove from my plan" on a pattern day is just a `false` override.
- B. Per-date plans only, generated from the weekly days. This means a job to roll plans forward, and the weekly days and real plans drift apart.
- C. Weekly days only, as today. It can't express the prototype's "plan this date".

Closed days: a new store collection that admins edit (chosen), rather than extending the hard-coded holiday list (which needs a deploy) or reading dates out of announcements (fragile).

## Decided parts of the how

- **Store:**
  - `planOverrides`: `{ email, date, planned }`, with `setPlanOverride(email, date, planned | null)` (null removes it) and `listPlanOverrides(email, from, to)`.
  - `closedDays`: `{ date, reason, createdBy, createdAt }`, with `listClosedDays(from, to)`, `addClosedDay`, `removeClosedDay(date)`.
- **`daysView`:**
  - `planned` = override ?? weekly pattern, only for days after today that are working, not closed and not on leave.
  - Each day gets `closed: string | null` (the reason).
  - The month's "still to plan" and "coming up" are derived by pure functions in `lib/pace.ts` (or a new `lib/plan.ts`) so they can be unit-tested.
  - Today's "expected" counts (`around.next`) honour overrides and closed days.
- **API:**
  - `PATCH /api/days` with `{ date, planned: boolean }`. Allowed only for a future working date in the current or next two months that isn't closed. Returns 409 for anything else.
  - `/api/admin/closed-days`: GET, POST and DELETE, admin only.
- **Sending leave from the sheet** also clears any plan for those dates (a `false` override, or removing an added date).
- **Month navigation:** from the earliest fixable month to two months ahead, so people can plan into next month.
- **Leave left** comes from `useLeaveBalances().ledger` (`remaining`), labelled with its as-of date.
- **Admin:** a "Closed days" section on the existing admin tools page (list, add a date + reason, remove).

## Owner rulings after the builder check

- No "Working remote" anywhere: not coming in means remote. Home has only Check in, and it's quiet on days you're not planned in.

- Legend shows only Done, Planned, Leave. Remote isn't a calendar state (not coming in means remote). No "Still to plan" section; the calendar itself is the planner.

- The "In office today" card on Home keeps its names and avatars.
- The parts the prototype doesn't draw get drawn in the snapshot `docs/design/m3/Prototype.dc.html` first, in the prototype's style, before any code. That covers: fixing your last 7 days (tappable past cells opening a fix sheet), the locked-day note, the weekly Mon–Fri chips, your leave requests with cancel, and the admin Closed days section. The owner reviews the drawings, and the code follows them.

## Calls made after the builder check (author's calls, owner to check)

- **A closed day is not a working day anywhere.**
  - Leave across it costs nothing.
  - Pace and the next working day skip it.
  - `markDay` refuses "office" on it (409, "The office is closed that day").
  - To keep `lib/leave.ts` and `lib/office-days.ts` pure, the closed dates are loaded once per request and passed in as an extra `closed: ReadonlySet<string>` argument (default empty) to `isWorkingDay`, `nonWorkingReason`, `leaveCost`, `workingDaysInMonth` and the summary functions.
- **Today:**
  - Today's cell opens the sheet with only "Apply for leave" (calling in sick), unless the day is already marked. Planning today isn't offered; check-in on Home covers it.
  - A `false` override on today is impossible because the API rejects today, so `countsToday` keeps using the pattern plus overrides.
  - Leave for today also clears today's plan.
- **Counts across people:** a new store method `listPlanOverridesOn(date)` (all employees, one date), in both stores and the contract tests.
- **Route:** per-date plans get their own route, `PATCH /api/days/plan` with `{ date, planned }`. The existing `PATCH /api/days` (weekly days) is left alone.

## Left to the builder

- Exact component split under `components/days/`.
- Sheet and dialog primitive: extend `components/m3` if it has none.
- Copy for the empty, loading and error states, in the same voice as Home.
- The calendar's ARIA pattern (grid of buttons with descriptive labels, as the prototype does).
