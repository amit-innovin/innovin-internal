# User journey repairs - 27 October 2026

This repairs the [original journey audit](2026-10-27-user-journey-and-information-architecture.md). The existing visual design is retained: no stylesheet, color, spacing or card-layout changes. Task labels, destinations, save behavior and management controls now describe their actual outcomes. The baseline inventory remains historical because counts depend on employee data and expanded states.

## Information architecture after repairs

```text
Home: presence, actual-attendance pass, pantry requests, people, public board, upcoming events
Main Attendance & Leave -> formal local Leave/WFH requests
Attendance -> Today / recorded Calendar / Leave (each addressable by URL)
More -> Personal plans (private, separate from HR), People, Wi-Fi, Speak Up, Help
Steps -> quick saved increments / explicitly unsaved manual entry
Meals & Snacks -> autosaved request / fulfillment status / history
Events -> read / RSVP / organizer edit and cancellation
Admin -> approvals / people / publishing / pantry fulfillment
Purchasing -> supplier connection, reviewed basket, explicit purchase, receipts and recovery
```

## Each finding and its resulting behavior

| Finding | Result |
| --- | --- |
| 1. Competing leave meanings | Main navigation, balance chips and request links open actual Leave. Personal plans explicitly state that they do not request approval or record attendance. Zoho submission is never implied. |
| 2. Pass used private plans | Both pass calendars read recorded attendance, approved leave and holidays. Desktop date links preserve the exact day. Reverse-side motion settles so controls remain clickable. |
| 3. Mobile announcement destination | Board is URL-backed. Notifications load and scroll to the exact announcement, including targets outside the initial list; reload and Back preserve the destination. Missing content has an explicit state. |
| 4. Public feedback privacy cues | Public team feedback and anonymous author have distinct meanings. Lock cues were removed. The public board links to the private Speak Up workflow. |
| 5. Tray mistaken for purchase/delivery | Internal requests have coordinator-controlled Request received, Being prepared, Ready for collection and Collected / delivered states. Employee changes lock atomically at preparation. Supplier purchases and cancellations remain separate. |
| 6. Quick steps were unsaved | Quick increments persist immediately. Manual entries show Save unsaved steps; progress uses the saved count. Concurrent writes are blocked. |
| 7. Conflicting pantry save patterns | Both pantry surfaces autosave selections, and the full page saves notes on blur. Saved feedback is explicit. Clear/cancel confirms; cancellation waits for pending notes so the request cannot reappear. Home category chips select the item. |
| 8. Event creation was a dead end | Organizers/admins can edit and cancel future events in the shared composer. Existing RSVPs survive edits. Stale or unauthorized edits fail safely; cancelled/deleted events reject late RSVPs. |
| 9. Optional Home controls dominate | Layout retained as requested. People defaults to Office; incidental person clicks no longer send messages. The board retains its existing size cap, with intrinsic-height note rows scrolling instead of squeezing text out of cards. Daily-task destinations are corrected. A smaller board or compact-list redesign is deliberately outside this unchanged-UI repair. |
| 10. Links discarded intent | Attendance tab/date/request, event, board and private-plan dates use explicit URLs. Reload, Back/Forward and sign-in recovery retain relevant destinations. Same-page event notifications fetch the target directly. |
| 11. Account/copy labels drifted | Copy work email names its actual result. Google admin access and PIN-only session controls are distinguished. Account switching preserves the current page/query. |
| 12. Public removal lacked protection | Removing a public board post requires confirmation; dismissing leaves the post intact. |
| 13. Attractive controls did the wrong job | Project bubbles focus their project; teammate clicks open read-only profiles; sending a note requires an explicit action. Events say Upcoming. Repeat last request repeats the actual latest historical request. Directory search works by name/email. Teammate name pills retain the existing colors and no longer render white text on white backgrounds. |
| 14. Unrelated operator saves | Fitness adjustments save separately on blur instead of being silently bundled into Save balances. Snapshot/reconciliation and local approval language remain explicit. The existing panel placement is retained. |

## Reliability behind the visible actions

Request fulfillment compares the exact reviewed row IDs and current state under an atomic store operation. JSON and Postgres enforce the same rules. Postgres serializes employee edits and coordinator transitions on the same request lock. Reopening preparation is explicit and warns that it does not cancel supplier purchases.

Event changes compare a revision timestamp. RSVP writes serialize with cancellation/deletion. Private plan reads reject stale months as well as stale responses, including browser navigation during an in-flight save. Targeted event/announcement reads do not depend on an item happening to appear in the initial list.

Notifications remain derived from existing records; no notifications table or grievance-to-device link was introduced. Grievance updates are never pushed.

## Verification

- `npm run typecheck` and `npm run build -- --webpack`: passed on the final source.
- `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/innovin_readiness_test npm test`: 227 passed, including both JSON and Postgres store contracts.
- Full Postgres desktop/mobile matrix: 219 passed, one intentional desktop skip, and two failures caused by an incorrectly capitalized test expectation (the UI correctly displayed In office). The 31 API cases were deferred by project dependencies. The corrected journey/API completion run, `E2E_DATABASE_URL=postgres://postgres@127.0.0.1:54329/innovin_readiness_e2e npx playwright test journey-repairs.spec.ts api.spec.ts --no-deps`, passed 56 with one intentional skip on the final build. All distinct cases in the Postgres matrix have therefore passed across the full and affected runs.
- Complete JSON matrix (`npx playwright test`): 254 passed, one intentional desktop skip. This precedes only the final intrinsic-height board scrolling correction. The affected journey/design run passed 32 cases with one intentional skip, plus one fixture collision (the mobile run counted the desktop run's identically titled notes); titles are now unique and `npx playwright test journey-repairs.spec.ts --grep 'populated board|mobile board URL|browser Back during'` then passed five with one intentional skip on the final build. The populated-board cases also passed on Postgres.
- iPhone WebKit: all 33 distinct cases passed across the initial 31 passing cases and two affected reruns. Coverage includes SE, iPhone 13 and 16 Pro Max wallet/calendar/dialog/steps/planner checks, the complete repaired journeys on iPhone 13 and supplier-fixture safety. Two initial cases completed their behavior assertions but failed the unchanged console guard during hard document navigation. Settling unrelated initial prefetches before OAuth/fixture reloads made both pass; the planner still navigates Back while the save POST is held. No errors are filtered. This is test setup stabilization, not a product fix or proof of the exact engine cause; the cancellation pattern matches reported [same-origin replacement errors](https://github.com/microsoft/playwright/issues/43120) and [Next prefetch cancellation](https://github.com/microsoft/playwright/issues/42823).
- Red regressions were observed before their fixes: unsaved quick steps; stale month data after browser Back during save; invisible teammate names; fitness autosave disabling the unrelated balance action; and populated board cards overflowing their text. The event-target regression also failed before its focused-route fetch fix.
- Independent source review found no remaining blockers after fixing the planner, RSVP/cancellation and autosave/cancellation races. Screenshot review covered desktop Home, mobile board and request/fulfillment screens. Local browser checks use fake Google identities and an isolated supplier fixture; no production rows were used.

## What this does not establish

No live provider order, Zoho write, deployment, employee usability study or physical Android/iPhone smoothness measurement was performed. Instamart requires approved live access/configuration; Blinkit remains unavailable without approved partner access. Zoho People remains authoritative, with the existing optional read-only connection/manual snapshots; submitting and approving through Zoho is not implemented. Local approval labels explicitly describe local coordination.

## Release path

Branch: `user-journey-repairs`, based on `origin/main` at `9cc9d1a` (PR #5). The owner's existing `PRODUCT.md` changes and PDF are excluded from this repair.

The GitHub CLI cannot resolve the private repository with its current authenticated account. The repository-mandated fallback is the [new-PR comparison](https://github.com/amit-innovin/innovin-internal/pull/new/user-journey-repairs). No local merge, direct main push or deployment bypasses that required PR. No merge or production deployment is established by this report.
