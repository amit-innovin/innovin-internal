# User journey repairs - 27 October 2026

## Outcome and authorization

Fix every actionable issue from `docs/release-audits/2026-10-27-user-journey-and-information-architecture.md` while preserving the existing visual design: routes/cards, spacing, colors, type and motion. User explicitly authorized all necessary fixes without approval questions. Copy, link targets, save semantics, existing dialogs and small inline management/status controls may change to make the journeys complete. No navigation/card redesign, real provider purchase, invented Blinkit/Zoho write integration or unsupported delivery claim.

Base: fresh `origin/main` after PR #5. Preserve owner PRODUCT.md/PDF and local audit artifacts. New branch `user-journey-repairs`.

## Decisions

- Formal leave is primary: the existing main calendar link goes to Attendance > Leave, while `/planner` remains explicitly Personal plans. URL-backed tab/date/item state powers deep links and Back/reload.
- The pass reverse shows actual attendance, with clicked dates/months preserved into the attendance calendar. Mobile uses that same recorded-calendar meaning. Personal plans stay separate with an explicit formal-request link.
- Keep Home pantry autosave; make full-page selection/notes use the same immediate-save semantics and existing submit control an honest confirmation/flush action. Clearly label internal requests. Clear/cancel is confirmed. Add coordinator fulfillment progression requested -> preparing -> ready -> fulfilled to existing rows; freeze employee edits/cancellation once preparation starts, atomically in both stores. External purchases remain separate and never falsely mark delivery.
- Step shortcuts save the increment immediately, disable concurrent writes and retain the last saved count/progress on failure. Manual count edits clearly indicate unsaved draft; explicit Save remains.
- Public board feedback loses lock/confidential wording; anonymous means hidden author, not private content. Protect moderation deletion with confirmation. Board has URL state and announcement focus; leave/event/report notifications preserve their target.
- Event creators can edit/cancel their own future events using the existing composer/dialog; admins can edit events in existing Publish rows. Server permissions and expected-version checks prevent arbitrary edits or lost updates; RSVPs survive edits. Creation/update/cancellation inform appropriate readers without exposing private content.
- Reuse existing profile dialog for selecting a teammate (read-only) instead of name clicks silently sending Hi. Arena starts with Office filter; project bubbles actually focus their project. No layout redesign.
- Correct Copy work email, Repeat last request, Upcoming events, role-aware Admin and session controls; remove duplicate ping Close. Separate fitness adjustments from balance-save side effects within existing People editor areas. Preserve account/task destinations across recovery.
- Existing optional hardware/provider limitations remain honest. No claim of physical-device smoothness or provider activation from fixtures.

## Vertical slices and checks

1. URL journeys: failing unit tests for typed route-state parsing/targets, then implementations and browser cases for mobile board notification, formal leave tab and attendance date/pass. Source trace for low-impact copy changes; no mirror tests for labels alone.
2. Save semantics: failing browser regression for quick steps persistence/error and pantry immediate saved state/cancellation confirmation; implementation followed by affected workspace/snacks/steps specs.
3. Fulfillment: failing shared store contract for progression/atomic edit lock, then JSON/Postgres migration/implementation, API coordinator authorization, existing-card status consumer and end-to-end employee/coordinator flow.
4. Events: failing store/API/browser coverage for creator edit/cancel, unauthorized actor, stale edit and RSVP preservation; implement both stores and reuse composer.
5. Trust/interaction completion: board delete confirmation, teammate view, project focus, labels, targeted notification and account recovery; focused browser checks and code review against each audit finding.
6. Full typecheck, unit + both storage contracts, webpack build, full JSON E2E and PostgreSQL E2E because stores changed; affected iPhone WebKit. Do not rerun unchanged passing suites without reason.
7. Independent dev-review, fix verified blockers, repeat affected gates. Update the audit with each finding's disposition and exact remaining provider/physical-device boundary.

## Done criteria

Every audit finding is fixed or explicitly bounded by the unchanged-design constraint or unavailable third-party access; every important action gives the promised result, correct destination and persisted state. No silent planner-to-HR coupling. No supplier cancellation implied by tray cancellation. Preserve anonymity and provider checkout safeguards. Follow branch -> PR -> merge workflow; no direct main push/local merge. User's broad authorization covers taking the repair through normal shipping, but any unavailable repository/provider access is reported rather than bypassed.

## Completion

Implementation and local verification completed. The [repair report](../../release-audits/2026-10-27-user-journey-repairs.md) records all finding dispositions, full/affected browser runs on JSON and Postgres, iPhone WebKit coverage, and the separate live-provider/physical-device boundaries. Independent review blockers were resolved. The existing visual design is retained, including the board size cap; reading controls settle and note cards now scroll at their intrinsic height.

The normal PR merge/deploy path is blocked by the current GitHub CLI account lacking private-repository access. Use the required pushed-branch compare-URL fallback, never a direct main push or local merge.
