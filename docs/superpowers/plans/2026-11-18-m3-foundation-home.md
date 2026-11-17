# Material 3 Foundation + Home (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Duo Pop look with the Material 3 design from the new prototype: a new token set, primitives and app shell, location-only check-in, and a rebuilt Home.

**Architecture:** New design code lives beside the Duo code, under a `.m3` CSS scope and `components/m3/`, so screens move over one stage at a time. The shell switches to Material 3 for every rebuilt route in this stage; screens not rebuilt yet keep their Duo styling inside the new shell (the root carries both `m3` and `duo` classes). Pure rules (pace verdict, week strip, time of day, Speak up button visibility) go in small `lib/` files with unit tests; UI is covered by Playwright.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching routing or fonts), React 19, TanStack Query (`lib/queries.ts`), Tailwind 4 + plain CSS, lucide-react icons, Vitest, Playwright.

**Spec:** the prototype canvas https://claude.ai/artifact/DFhALZi4uN4Sxm7ng8CGN6 (phone: `Prototype.dc.html`, desktop: `DesktopPrototype.dc.html`), snapshotted in Task 1 to `docs/design/m3/`, and the rationale page https://claude.ai/artifact/BDMRzx3hjYJtsmx6DucccG. Where they disagree, the canvas wins.

## Global Constraints

- Branch: `m3-foundation-home`, cut from `phase2-shell`. `phase2-shell` (the Duo builds) stays untouched so the owner can switch between the two designs at any time (owner, 18 Nov).
- This branch must NOT be merged into `main` (owner, 18 Nov), which overrides AGENTS.md's "every branch ships as a PR to main" for this work. Push only with the owner's go-ahead, using the `gautham-inv` GitHub account.
- Colours (copy exactly): primary `#006493`, on-primary `#FFFFFF`, primary container `#CAE6FF`, on-primary container `#001E30`, secondary container `#D3E5F5`, on-secondary container `#0C1D29`, tertiary `#65587B`, tertiary container `#EBDCFF`, on-tertiary container `#20142F`, ground `#F1F4FA`, surface `#FFFFFF`, surface container `#EBEEF4`, on-surface `#181C20`, on-surface variant `#41474D`, outline `#71787E`, outline variant `#C1C7CE`, success `#2E7D4F`, success container `#CDEBD6`, on-success container `#0B3D1F`, warning container `#FFDDB0`, on-warning container `#4A2800`, error `#BA1A1A`, Speak up button `#24222F`.
- Font: Figtree (400, 500, 600, 700) via `next/font/google`, exposed as `--font-figtree`.
- Copy rules: sentence case; no exclamation marks in status text; verdict wording exactly as in Task 3.
- Numbers rule: no headcounts, totals or "done · planned · needed" lines on Home.
- Lappy appears only in the Home header (owner decision) in this stage; never on check-in or attendance UI.
- Reading list is out of the design: removed from all navigation; its route stays but has no entry point.
- Every animation stops under `prefers-reduced-motion: reduce`.
- New dependencies: none expected. If one is needed, pin an exact version published at least 7 days ago.
- Any Store change must land in both `lib/jsonstore.ts` and `lib/pgstore.ts` and in `tests/store/contract.ts` (none expected in this stage).

## Review Focus

- Location permission denied, or the browser has no geolocation: the card must show "Location is off for innovin" with Try again and Working remote, never a spinner that never ends. (Task 4 e2e "location blocked".)
- A position far from the office: the card shows the distance from the server ("about 3.4 km") and offers Working remote. (Task 4 e2e "away from the office".)
- Remote day: Home must hide the tea round and today's crowd and show the next overlap instead. (Task 7 e2e "remote day".)
- Office exempt or target 0 (mid-month joiner, exempt staff): the verdict must not say "Plan 8 more"; it reads "No office days needed this month". (Task 3 unit test.)
- Late evening IST vs UTC: time of day must use IST, so 18:30 UTC (midnight IST) is "evening", not "afternoon". (Task 3 unit test.)

---

## Before starting

- [x] Base confirmed: separate branch from `phase2-shell`, never merged to `main`.
- [ ] Ask the owner the open moderation question (recorded defaults: sign-in required, admin can hide, warn before sending). It does not block this stage.

### Task 1: Snapshot the prototype and point AGENTS.md at it

**Files:**
- Create: `docs/design/m3/Prototype.dc.html`, `docs/design/m3/DesktopPrototype.dc.html`, `docs/design/m3/canvas.json`, `docs/design/m3/README.md`
- Modify: `AGENTS.md` (section "Design: the canvas is the source of truth")

- [ ] **Step 1:** Read the canvas (Artifact read of `project/Prototype.dc.html`, `project/DesktopPrototype.dc.html`, `project/canvas.json`) and save the three files to `docs/design/m3/`.
- [ ] **Step 2:** Write `docs/design/m3/README.md`: canvas URL, rationale URL, snapshot date, and a table mapping prototype screens to routes (`/` Home, `/feed`, `/days`, `/snacks`, `/account`, `/steps`, `/wifi`, `/grievances` Speak up, `/notifications`) with the stage that rebuilds each (Home: stage 1; the rest: later stages).
- [ ] **Step 3:** In `AGENTS.md`, replace the Duo canvas URL and the Duo-primitives paragraph with: the new canvas and snapshot path; new UI uses `components/m3` and `app/m3.css` (scoped under `.m3`); Duo files stay until every screen has moved; tappable means filled, tonal or outlined button, or a row with a chevron; flat means information.
- [ ] **Step 4:** Commit.

```bash
git add docs/design/m3 AGENTS.md
git commit -m "docs(design): snapshot the Material 3 prototype and make it the build reference"
```

### Task 2: Tokens, font and primitives

**Files:**
- Create: `app/m3.css`, `components/m3/index.tsx`, `components/m3/sheet.tsx`
- Modify: `app/layout.tsx` (load Figtree), `app/(member)/(duo)/layout.tsx` (import `app/m3.css` if CSS is imported per layout; follow how `app/duo.css` is imported today)
- Test: `e2e/m3-primitives.spec.ts` is not needed; primitives are covered through Tasks 5 to 7.

**Interfaces:**
- Produces (all from `components/m3/index.tsx`):
  - `Button(props: ButtonHTMLAttributes & { variant?: "filled" | "tonal" | "outlined" | "text" })` with class `m3-btn m3-btn-<variant>`
  - `Card(props: HTMLAttributes<HTMLDivElement>)` (white surface, radius 24)
  - `StatusChip({ tone, children }: { tone: "success" | "warn" | "neutral"; children: ReactNode })`
  - `ListRow({ href?, onClick?, leading?, title, subtitle?, trailing?, chevron? }: ...)` renders `<a>` or `<button>` with class `m3-row`
  - `IconCircle({ tone, children }: { tone: "primary" | "secondary" | "tertiary" | "success" | "warn" | "neutral"; children: ReactNode })`
  - `Fab({ href, label, icon }: { href: string; label: string; icon: ReactNode })`: icon-only, 56×56, radius 16, dark `#24222F`; `label` becomes `aria-label` and `title`
  - `QueryState` with the same props as the Duo one
- Produces from `components/m3/sheet.tsx`: `Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode })`: bottom sheet below 1100px, centred dialog from 1100px; `role="dialog"`, `aria-modal="true"`, `aria-label={label}`, Escape closes, focus moves into the sheet.

- [ ] **Step 1:** Add Figtree in `app/layout.tsx` next to the existing fonts: `const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" })`, and add `figtree.variable` to the `<html>` className list.
- [ ] **Step 2:** Write `app/m3.css`: every colour from Global Constraints as a custom property on `.m3` (`--m3-primary` etc.), type scale (`.m3-h1` 28/36 600, `.m3-title` 16/24 600, `.m3-body` 15/22, `.m3-small` 13/18 on-surface variant), and the microinteractions: `button`/`a.m3-row` transition 0.12s; `:active` scale 0.96; `[aria-pressed="true"]` plays `m3-pop` (0.92 → 1.06 → 1, 0.32s); bars use `transition: width .45s cubic-bezier(.2,.8,.2,1)`; the `prefers-reduced-motion` block sets animation and transition durations and delays to 0.
- [ ] **Step 3:** Implement the primitives listed under Interfaces. Buttons are 40px tall (48px when `className` includes `m3-btn-lg`), fully rounded; tonal uses secondary container.
- [ ] **Step 4:** Run `npm run typecheck`. Expected: exit code 0.
- [ ] **Step 5:** Commit.

```bash
git add app/m3.css components/m3 app/layout.tsx "app/(member)/(duo)/layout.tsx"
git commit -m "feat(m3): Material 3 tokens, Figtree and core primitives"
```

### Task 3: Pure rules for Home (pace, week strip, time of day)

**Files:**
- Create: `lib/pace.ts`
- Test: `tests/unit/pace.test.ts`

**Interfaces:**
- Consumes: `DaysView` from `lib/days.ts` (fields `today`, `summary.done`, `summary.target`, `days[]` with `date`, `mode`, `planned`, `working`, `leave`, `off`; `me`; `isOfficeDayToday`).
- Produces:
  - `plannedCount(view: DaysView): number`: future days with `planned: true`, plus today when `me` is null and `isOfficeDayToday` is true.
  - `paceVerdict(input: { done: number; planned: number; target: number }): { state: "done" | "track" | "short" | "none"; short: string; long: string; tone: "success" | "warn" | "neutral" }`
  - `weekStrip(view: DaysView): { date: string; label: string; day: number; state: "done" | "planned" | "empty" | "leave" | "off"; today: boolean }[]`: Monday to Friday of the week containing `view.today`.
  - `timeOfDayIST(now: Date): "morning" | "afternoon" | "evening"`: before 12:00 morning, before 17:00 afternoon, else evening, in Asia/Kolkata.

- [ ] **Step 1: Write the failing tests** in `tests/unit/pace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paceVerdict, timeOfDayIST } from "@/lib/pace";

describe("pace verdict", () => {
  it("done at 8 of 8", () => expect(paceVerdict({ done: 8, planned: 0, target: 8 })).toEqual({ state: "done", short: "Done for November", long: "Done: 8 of 8 office days", tone: "success" }));
  it("exactly 8 with plans is on track, not tight", () => expect(paceVerdict({ done: 5, planned: 3, target: 8 })).toMatchObject({ state: "track", short: "On track", long: "On track. Every planned day counts", tone: "success" }));
  it("spare days are counted", () => expect(paceVerdict({ done: 5, planned: 4, target: 8 })).toMatchObject({ short: "On track · 1 spare", long: "On track, with 1 spare day" }));
  it("short asks for the missing days", () => expect(paceVerdict({ done: 4, planned: 2, target: 8 })).toMatchObject({ state: "short", short: "Plan 2 more", long: "Plan 2 more days to reach 8", tone: "warn" }));
  it("no target means nothing to plan", () => expect(paceVerdict({ done: 0, planned: 0, target: 0 })).toMatchObject({ state: "none", short: "No office days needed", tone: "neutral" }));
});

describe("time of day in IST", () => {
  it("09:30 IST is morning", () => expect(timeOfDayIST(new Date("2026-11-16T04:00:00Z"))).toBe("morning"));
  it("14:00 IST is afternoon", () => expect(timeOfDayIST(new Date("2026-11-16T08:30:00Z"))).toBe("afternoon"));
  it("midnight IST is evening", () => expect(timeOfDayIST(new Date("2026-11-16T18:30:00Z"))).toBe("evening"));
});
```

Add `plannedCount` and `weekStrip` cases built from a small `DaysView` fixture: Monday 16 Nov 2026 as today, not marked, office day; Wednesday planned; expect `plannedCount` to count today plus Wednesday, and `weekStrip` to return five entries with today flagged.

- [ ] **Step 2:** Run `npx vitest run tests/unit/pace.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `lib/pace.ts`. The month name in `short`/`long` comes from the target month ("Done for November"); pass it in as an optional `month` (YYYY-MM) argument if needed, defaulting to the current IST month.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(home): pace verdict, week strip and time of day rules`.

### Task 4: Location-only check-in

**Files:**
- Modify: `lib/geo.ts` (`officeCheck`), `lib/days.ts` (`markDay`), `app/api/days/route.ts`, `components/home/check-in.tsx` (replaced in Task 7; until then keep it compiling)
- Test: `tests/unit/office-check.test.ts`, `e2e/home.spec.ts`

**Interfaces:**
- Changes: `officeCheck(input: { lat: number | null; lng: number | null })`, returning `{ ok: true; source: "location" | "self" } | { ok: false; code: "location-needed" } | { ok: false; code: "outside"; distanceM: number }`. `onOfficeNetwork` and `officeIps` are deleted, along with every use of them.
- `markDay` input drops `ip`. The API route still rate-limits by IP through `enforce`.
- Existing rows with `source: "wifi"` still display ("Verified on office Wi-Fi") because history must not change.

- [ ] **Step 1:** Rewrite `tests/unit/office-check.test.ts`: delete the Wi-Fi case; keep "asks for a location, then accepts only inside the geofence" and "no office configured" with the new signature.
- [ ] **Step 2:** Run it. Expected: FAIL (type or argument mismatch).
- [ ] **Step 3:** Change `officeCheck`, `markDay` and the route. Grep for `onOfficeNetwork`, `officeIps` and `OFFICE_IPS` and remove every use, including `.env.example`.
- [ ] **Step 4:** Run `npx vitest run tests/unit/office-check.test.ts` and `npm run typecheck`. Expected: PASS, exit code 0.
- [ ] **Step 5:** Commit: `feat(days): check-in is verified by location only`.

### Task 5: Material 3 shell (bottom bar, sidebar, Speak up button)

**Files:**
- Create: `components/m3/app-shell.tsx`
- Modify: `lib/nav.ts`, `app/(member)/(duo)/layout.tsx` (render the new shell), `tests/unit/nav.test.ts`
- Test: `tests/unit/nav.test.ts`, `e2e/navigation.spec.ts`

**Interfaces:**
- `lib/nav.ts`: remove the `reading` item from `ITEMS`, `NavId` and `NavIcon`, and `/reading` from `owns`. Add `showsSpeakFab(pathname: string): boolean`: true for `/`, `/days`, `/snacks`, `/account`, and false everywhere else (including `/feed`, `/grievances`, `/wifi`, `/notifications`, `/steps`, `/admin...`).
- `AppShell` keeps the Duo shell's props `{ name, isAdmin, openReports, children }`. The root `<div className="m3 duo">` keeps Duo screens styled until they move.

- [ ] **Step 1:** Extend `tests/unit/nav.test.ts`: bar items are exactly Home, Feed, Days, Snacks, Account; sidebar items are Home, Feed, Days, Tea & snacks, 10K steps (no Reading list); `showsSpeakFab` returns true for `/`, `/days`, `/snacks` and `/account`, and false for `/feed`, `/grievances` and `/admin`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/nav.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Update `lib/nav.ts`; build `components/m3/app-shell.tsx` from the prototype:
  - Phone bottom bar: 80px, surface container, 64×32 pill indicator in secondary container.
  - Desktop sidebar (≥1100px): the sidebar items plus a "Speak up" item, then the account button with the same menu as today minus Speak up and Wi-Fi check, which now live on Home.
  - The icon-only Speak up `Fab` (speech bubble with a shield inside, aria-label "Speak up anonymously") above the bottom bar when `showsSpeakFab(pathname)` is true (phone only; desktop uses the sidebar item with the same icon).
- [ ] **Step 4:** Run the unit test (expected PASS), then `npx playwright test navigation.spec.ts --project=mobile` and update any assertion that named "Reading list" or the old Account-menu entries.
- [ ] **Step 5:** Commit: `feat(shell): Material 3 bottom bar, sidebar and Speak up button`.

### Task 6: Page headers and Home illustrations

**Files:**
- Create: `components/m3/hero.tsx`, `components/m3/art.tsx`
- Test: covered by Task 7's e2e.

**Interfaces:**
- `PageHero({ page, title, subtitle, actions, children }: { page: "home" | "feed" | "days" | "snacks" | "account" | "steps"; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode })`: tinted band (home `#D6ECFA`, feed `#FFE9D6`, days `#ECE6FB`, snacks `#FFF3CC`, account and steps `#DDF1E4`), art on the right, text column at most 60% wide, bottom radius 28.
- `HomeScene({ time }: { time: "morning" | "afternoon" | "evening" })`: an SVG with `role="img"` and `aria-label` set to "Lappy with a cup of chai", "Lappy waving" or "Lappy dozing under the moon". Evening switches the Home band to `#2E3A66` with white text.
- `PageArt({ page }: { page: "feed" | "days" | "snacks" | "account" | "steps" })`: `aria-hidden` SVG.

- [ ] **Step 1:** Port the SVG scenes from `docs/design/m3/Prototype.dc.html` (the header bands) into `art.tsx` as React components, keeping coordinates and colours. Convert attributes to camelCase JSX (`strokeWidth` and so on).
- [ ] **Step 2:** Build `PageHero` per the interface.
- [ ] **Step 3:** Run `npm run typecheck`. Expected: exit code 0.
- [ ] **Step 4:** Commit: `feat(m3): page headers with illustrations and time-of-day Lappy`.

### Task 7: New Home

**Files:**
- Modify: `components/home/home-page.tsx` (rewrite), `components/home/check-in.tsx` (rewrite)
- Test: `e2e/home.spec.ts` (rewrite to the new UI)

**Interfaces:**
- Consumes: `useDays`, `useMarkDay`, `MarkDayError`, `useTea` and the existing tea mutation used by the Snacks screen, `useWorkspace` (next event and its RSVP mutation), `useFeed` (open poll), `useSteps`; `plannedCount`, `paceVerdict`, `weekStrip` and `timeOfDayIST` (Task 3); `PageHero` and `HomeScene` (Task 6); and the primitives (Task 2).
- `CheckIn({ days }: { days: DaysView })`: before check-in, a card with the location line, then "Check in" and "Working remote". Tapping Check in always asks for a position first, then posts with coordinates. Its states, in order:
  - checking: spinner and "Checking your location…"
  - success: the card turns success container, a check mark draws, and "You're in · Checked in at {time} · location confirmed" shows for 1.1s
  - remote: grey, with a house icon and "Working remote today", for 0.9s
  - outside: "You're about {distance} from the office", with Try again and Working remote
  - blocked: "Location is off for innovin", with Try again and Working remote
- After check-in: no card. The status chip in the header reads "In office · {h:mm}" or "Remote today", with a separate "Change" text button that clears the mark.

Layout, top to bottom, as in the prototype:
1. `PageHero` "home": greeting "Good morning|afternoon|evening, {firstName}", date, status chip, then the Wi-Fi icon link (`/wifi`, label "Check office Wi-Fi"), the notifications bell and the avatar (`/account`).
2. `CheckIn`, only when `days.me` is null.
3. "Up next" card:
   - a tea row (only when `days.me?.mode === "office"`), with a "Yes, I'll have tea" / "Skip" pair or the answered state, and Lappy on the right once answered yes;
   - the next event row with "I'm in";
   - an open poll row linking to `/feed`.
4. "This week" card: the `weekStrip` circles, the verdict chip (`paceVerdict(...).short`) and a "Plan days" link to `/days`.
5. Your crowd: when not remote, face cards for `around.inToday.names` (nothing when empty); when remote, one card with "Your crowd is in on {around.next.date as 'Wed 18'}" and a Days link.
6. Steps tile: today's steps, a ring toward 10,000, and the league rank line, linking to `/steps`.

- [ ] **Step 1: Rewrite `e2e/home.spec.ts`** with these tests (assertions shown are the required ones):
  - "near the office: checks in by location and collapses to a chip": grant geolocation at (12.9352, 77.6241), click "Check in", expect `getByText("You're in")`, then `getByRole("button", { name: "Change" })`, and expect no button named "Check in".
  - "away from the office: says how far and offers remote": position (12.99, 77.7), click "Check in", expect text matching `/about \d+(\.\d)? km from the office/`, click "Working remote", expect `getByText("Remote today")`.
  - "location blocked: says so and remote still works": no permission; expect `getByText("Location is off for innovin")`.
  - "remote day hides office-only items": after Working remote, expect no "Tea round" text and no region named "Your crowd today"; expect text matching `/Your crowd is in on/`.
  - "header greets by time of day and shows Lappy": expect the h1 to match `/Good (morning|afternoon|evening),/` and `getByRole("img", { name: /^Lappy / })` to be visible.
  - "this week shows a verdict, not counts": expect region "This week" to contain one of "On track", "Plan", "Done" or "No office days needed", and expect no text matching `/\d+ in (the office|today)/`.
- [ ] **Step 2:** Run `npx playwright test home.spec.ts --project=mobile`. Expected: FAIL.
- [ ] **Step 3:** Rewrite `check-in.tsx` and `home-page.tsx` per the layout above, using only `components/m3` primitives (no Duo classes).
- [ ] **Step 4:** Run `npx playwright test home.spec.ts` (both projects). Expected: PASS. Save screenshots to `output/playwright/m3-home-<project>.png`.
- [ ] **Step 5:** Run the stage gate: `npm run typecheck && npm test`, then `npx playwright test`. Expected: all green. Fix any other spec that asserted Duo-only Home text.
- [ ] **Step 6:** Commit: `feat(home): Material 3 Home with location check-in, Up next and this week`.

### Task 8: Hand-off (no merge to main)

- [ ] **Step 1:** Report the branch, the commits and the screenshots to the owner, and show how to switch: `git checkout phase2-shell` (Duo) or `git checkout m3-foundation-home` (Material 3).
- [ ] **Step 2:** Only with the owner's go-ahead: run `gh auth status` (switch to `gautham-inv` if needed) and `git push -u origin m3-foundation-home` for a Vercel preview. No PR into `main`.

---

## Later stages (separate plans)

2. Days: tap a date for a sheet with "Plan to come in" and "Apply for leave" (type chips with what's left including pending, half day for Casual, sent to Zoho); "Leave left" chips under the calendar header (from `useLeaveBalances`); requested days dashed; closed days; verdict chip on the calendar.
3. Feed: Stories pager ending in "Start over", type-tinted cards, the important-announcement sheet with a per-person acknowledgement table (both stores plus contract) and "seen by" counts for admins, desktop list.
4. Tea and snacks: daily single snack pick with a cut-off, suggestions for coming days, remote state.
5. Account, Notifications, Wi-Fi check (with the mini-game), Steps (league, nudges).
6. Speak up: the screen, plus moderation (sign-in required, admin hide, warn before send) once the owner confirms.
7. Say hi: gestures and invites, a new `pings`-style table in both stores, a 3-a-day limit, replies from Notifications, and the push text decision.
