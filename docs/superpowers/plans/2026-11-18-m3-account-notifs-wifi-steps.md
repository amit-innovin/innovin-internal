# Account, Notifications, Wi-Fi and Steps — Material 3 (Stage 5): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the four remaining personal screens from the prototype. This includes the opt-in step league with nudges, a gated Wi-Fi report, and notifications only about things that involve you.

**Architecture:**
- Store additions:
  - the league flag on employees;
  - a `nudges` table;
  - an `area` field on Wi-Fi reports.
- Pure rules go in `lib/steps-rules.ts` (7-day series, league table and gap line) and `lib/wifi-rules.ts` (verdict).
- Routes are extended in place.
- Each screen gets its own folder under `components/`.

**Tech Stack:** Next.js 16.4.6, React 19, TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-m3-account-notifs-wifi-steps-design.md`. Prototype: `docs/design/m3/Prototype.dc.html` and `DesktopPrototype.dc.html`.

## Global Constraints

The Feed plan's global constraints apply here unchanged. In addition:
- Pushes never carry grievance content.
- Wi-Fi reports store no identity.
- Nudges only go between league members.

## Review Focus

1. **Nudging someone who left the league, or nudging twice in a day.** Expect 403 and 409 respectively. Test in Task 3 (API).
2. **Adding steps twice.** Totals add up, and the 50,000 cap applies to each add. Test in Task 3.
3. **A Wi-Fi report sent without an office check-in.** Expect 403, and the report row has no email. Test in Task 3.
4. **The tea notification.** It shows only while you're in the office, the round is open and you haven't answered, and it disappears after you answer. Test in Task 4 (e2e, with times set through the admin route).
5. **Steps from people outside the league.** They are never shown to others, not even in the week leaderboard. Test in Task 2 (unit) and Task 3 (API).

---

### Task 1: Store

**Files:** `lib/types.ts`, `lib/jsonstore.ts`, `lib/pgstore.ts`, `tests/store/contract.ts`

**Produces:**
- `EmployeeRow.stepsLeague?: boolean`, read as `false`.
- `setStepsLeague(email, on): Promise<boolean>`.
- `addNudge(date, from, to): Promise<boolean>`.
- `WifiRow.area?: string | null`.
- pg:
  - `ALTER TABLE employees ADD COLUMN IF NOT EXISTS steps_league boolean NOT NULL DEFAULT false`;
  - a `nudges` table;
  - `ALTER TABLE wifi ADD COLUMN IF NOT EXISTS area text`.

- [ ] Contract tests: league defaults false and toggles; a nudge is unique per day and direction; Wi-Fi `area` round-trips. Confirm RED, implement, confirm GREEN, commit.

### Task 2: Pure rules

**Files:** create `lib/steps-rules.ts` and `lib/wifi-rules.ts`, each with unit tests.

**Produces:**
- `sevenDays(rows: { date: string; steps: number }[], today: string): { date: string; steps: number }[]`. Returns exactly 7 entries, zero-filled, oldest first.
- `leagueTable(rows, members: Set<string>, me: string, period: "week" | "today")`. Returns `{ rank, email, name, steps }[]` for members only, sorted by steps, then name.
- `gapLine(table, me)`. Returns `"{n} steps to pass {Name} this week"` or `"You're leading. Enjoy the view."`, or `null` when you're not in the table.
- `wifiVerdict({ down, up, delayMs }): "slow" | "good"`, using the spec's thresholds (down < 10, up < 5, delay > 150 → slow).

- [ ] Write the tests:
  - the zero-fill and order;
  - non-members excluded (Review Focus 5);
  - the gap line for leading, behind and absent;
  - each verdict threshold.

  Confirm RED, implement, confirm GREEN, commit.

### Task 3: Routes

**Files:**
- `app/api/steps/route.ts`: `{ add }`, plus a league-only view.
- Create `app/api/steps/league/route.ts` and `app/api/steps/nudge/route.ts`.
- `app/api/wifi/route.ts`: session plus office gate, and `area`.
- Create `app/api/wifi/upload/route.ts` and `app/api/wifi/ping/route.ts`.
- `lib/notifications.ts`: tea and kudos-to-you items; drop items that involve other people.
- `lib/member-features.ts`: the league uses members only.
- Test: `e2e/api.spec.ts`.

- [ ] API tests for Review Focus 1, 2, 3 and 5. Also check that `/api/notifications` includes a "gave you kudos" item after someone sends you kudos. Build, confirm RED, implement, rebuild, confirm GREEN, commit.

### Task 4: Screens

**Files:**
- Rewrite `components/account/account-page.tsx`, `components/notifications/*`, `components/wifi/wifi-page.tsx` and `components/steps/steps-page.tsx`, splitting each where it helps.
- The Home steps tile shows the league line only when you're in.
- Hooks go in `lib/queries.ts`.
- Tests: rewrite `e2e/steps.spec.ts` and the stale UI parts of `e2e/notifications.spec.ts` and `e2e/grievances-wifi.spec.ts`. Add `e2e/account.spec.ts`.

- [ ] E2E tests:
  - **Account:**
    - The rows are exactly Notification settings, Help and Sign out for a member. An admin also sees Admin.
    - Sign out lands on sign-in.
  - **Notifications:** a kudos to you appears and links to `/feed`. The tea item appears and disappears (Review Focus 4).
  - **Wi-Fi:**
    - Run check shows "Testing download, upload and delay…", then a verdict with three numbers.
    - Not checked in: no report form.
    - Checked in: an area chip, then Send report, then "Sent to admins with your result".
  - **Steps:**
    - Add 2,500 twice gives 5,000.
    - Out of the league, the Join card shows. After joining, you're listed.
    - Nudge someone in the league: the button reads "Nudged", and a second nudge isn't offered.
    - Leave the league, and you're no longer listed.

  Build, confirm RED, implement, rebuild, confirm GREEN, commit.

### Task 5: Gates and review

- [ ] Run `tsc` and `vitest`, then the full Playwright run compared with the previous run.
- [ ] Get a fresh whole-branch review, then do one fix pass.
