# Workspace portal integration

## Outcome and source
Bring the supplied ZIP's complete workspace experience into the existing Next.js App Router application. Employees should sign in, declare office/remote presence, order pantry items, find colleagues, publish/RSVP to events, log steps, edit their calendar and send ephemeral notes through persisted workflows.

Reference: the user-supplied `innovin-internal.zip` (index.html, styles.css, app.js, README.md), reviewed 2026-10-15. It is a visual/interaction reference; its hardcoded employees, projects, telemetry, prize values, fake SSO, NFC and QR access claims are not real data.

Approved scope: visual design plus new product rules. Latest clarification: **Google sign-in for innovinlabs.com only**; no passwords, Apple, demo identities or new credential store.

## Architecture and boundaries
- Reuse existing Google OAuth, signed HTTP-only session, directory, events, steps, food ordering, pings, leave policy and both storage adapters.
- Add persisted workspace profiles (job title, department, project, floor, desk, focus, declared daily work mode) and per-person planner days. Public directory fields never imply admin access.
- Presence is a self-declared office/remote state backed by a same-day active attendance session; checked-out/stale sessions do not unlock pantry. Switching mode records a fresh declaration. No claim of verified physical access, VPN, network name or NFC access.
- Pantry: signed-in office presence, four distinct items per daily selection, server enforcement, existing cutoff and cancel/history behavior. Both home and the existing food page explain the gate.
- Verified employees can create events; admin deletion/publishing remains supported. Author identity comes from the session.
- Direct calendar editing is a personal availability declaration, separate from approved HR leave and Zoho balances; existing Attendance/Leave routes stay available and clearly linked.
- Arena groups actual colleagues by self-reported project; no seeded fictional projects or people. Wave/notes use existing recipient-directed, 24-hour pings.
- Leaderboard modes derive weekly steps, qualifying days, single-day record and department averages from logged counts; missing counts stay missing. Prize banner is optional configured company copy, with no invented prize value/deadline.
- Warm studio canvas, coral controls, editorial badge, horizontal navigation, rounded cards and responsive layouts are React/CSS. Badge swing/flip, note fly/crumple respect reduced motion. No embedded HTML page or global DOM-driven app.js.

## Slices and acceptance
1. Storage: profile and planner methods in `lib/types.ts`, `lib/jsonstore.ts`, `lib/pgstore.ts`; common store contract proves isolated upsert, partial profile update, range lookup and deletion. Run new tests red, then implement and run green.
2. API: workspace/profile/presence/calendar endpoints, strict domain/session/write validation, office-only food gate and employee event POST. Browser/API checks cover anonymous denial, persistence, remote denial, office ordering, logout/stale presence and event author enforcement.
3. UI: shared studio shell; signed-out Google onboarding with badge; signed-in overview with badge, pantry, arena and events; calendar and steps views; floating paper notes. Preserve support/admin routes and grievance anonymity. UI-only appearance edits use browser inspection instead of CSS unit tests.
4. Verification: typecheck, unit/store contracts, production build, targeted desktop/mobile Playwright for new workflows, existing affected coverage. Run Postgres contract and affected e2e against isolated local databases when available. Never use deployed DATABASE_URL for checks.

## Commands and done criteria
`npm run typecheck`, `npm test`, `npm run build`, `npx playwright test workspace.spec.ts --project=desktop --project=mobile`; broaden to existing impacted suites after targeted checks. Postgres: explicit `TEST_DATABASE_URL` / `E2E_DATABASE_URL` targeting local test databases only.

No push, PR, merge, deploy or production mutation is authorized. Preserve pre-existing PRODUCT.md edits and the untracked PDF. Report code, passed checks and unproven live OAuth/deployment separately.

## Design correction (user requested exact design)
- Use the supplied stylesheet verbatim in `app/reference.css`, with narrowly scoped integration overrides.
- Convert original lanyard/PVC markup to native React; use Plus Jakarta Sans, Playfair Display, JetBrains Mono and Caveat through next/font.
- Restore the original 420px-left/two-column dashboard, project canvas, time-column event cards, pantry item cards, gift visual, SVG step dial and calendar inspector.
- Retain only explicitly required differences: Google-only sign-in, actual account/data, truthful availability/HR/prize information, and accessible responsive behavior.
- Preview moved to port 5001 because it is registered in the Innovin OAuth client. No Mighty account/configuration is used. No push/deploy authorized.


## Verified local result
- `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed after final CSS layer and accessibility changes. Webpack is used because Turbopack cannot open its worker socket in this environment.
- `TEST_DATABASE_URL=<isolated local database> npm test`: 158 passed, including both JSON and Postgres store contracts.
- Desktop/mobile navigation, snacks, steps and workspace regression run: 48 passed.
- Postgres desktop/mobile workspace and navigation run: 34 passed.
- Final Postgres desktop/mobile workspace plus HTTP API/auth/privacy run: 46 passed. Includes explicit Google-account switching, company-domain rejection, current-office pantry gating, cross-device order ownership, event RSVP, calendar edits, step persistence and ephemeral note persistence.
- Source CSS in `app/reference.css` matches the supplied ZIP stylesheet byte-for-byte. Screenshots rendered and inspected at desktop/mobile sizes; artifacts are under ignored `output/playwright/`.
- Preview remains on port 5001 with an isolated local JSON store. Live Google credentials/configuration are Innovin's existing client; automated OAuth checks use a local mock, not real user accounts.
- No commit, push, PR, merge, deploy, Google Cloud mutation or production database writes. Existing PRODUCT.md edits and untracked PDF preserved.
- Full repository e2e matrix was not rerun; this is a local implementation handoff, not a release-readiness claim.
