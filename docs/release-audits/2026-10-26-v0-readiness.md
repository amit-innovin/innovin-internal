# Innovin Internal v0 release audit - 2026-10-26

**Baseline verdict: blocked. Evidence level: code-reviewed / not runtime-verified.**

The findings below describe the pre-repair working tree. See [the repair handoff](2026-10-26-v0-repairs.md) for subsequent implementation status; this baseline is retained as the audit record.

The main employee and coordinator features have real owning APIs and persistence. The release gaps are primarily inconsistent shared state, identity lifecycle, HR data integrity, and recovery behavior. Endpoint existence does not establish a complete user journey.

## Scope and revision

- Checkout: `innovin-internal`, branch `mobile-experience-polish`, HEAD `8a8c8cf0b4ebee1caae0b8545e1587d6fcba1860`.
- Audited working tree includes uncommitted mobile layout, whole-team paper notes, and read-only Zoho changes. `.env.example`, `README.md`, `app/api/leave/route.ts`, `app/layout.tsx`, leave components, workspace navigation/notes/phone/portal, and `lib/leave-data.ts` are modified; new mobile CSS/hook, Zoho adapter/component, plans and research are untracked. Owner changes to `PRODUCT.md` and an untracked PDF were preserved.
- Intended v0: employee Google sign-in; declared presence and attendance; office pantry selections and coordinator consolidation; directory/private pings; shared board; events/RSVP; personal planner; local leave/WFH requests and coordinator decisions; anonymous Speak Up; Wi-Fi reporting; steps; notifications. Instamart/Blinkit purchasing and Zoho submission/approval are outside this implemented release scope.
- Current read-only Vercel metadata: production deployment `dpl_BQU4M9XATPTzMGKQM83VnJXFiaaV`, READY, source commit `8a8c8cf0b4ebee1caae0b8545e1587d6fcba1860`, alias `innovin-internal.vercel.app`. Thus the current uncommitted changes are **not deployed**. READY is hosting metadata, not a successful product smoke test.
- No fixes, commits, pushes, deployments, provider mutations, or production test rows were made during this audit. This report is the only intentional repository content addition.

## Coverage and limits

Inventory: **12 page entry points, 24 API route files, 50 exported HTTP methods, 59 Store methods**. All page and API entry points were inspected and mapped below. Both store implementations and their contract were located, and persistence/identity seams were reviewed; this is not a fresh execution of all 59 store contracts. No server actions, scheduled jobs, or webhooks were found in the application source. Google callback and the push service worker are legitimate consumers without separate interactive screens.

Pages accounted for: `/`, `/admin`, `/attendance`, `/events`, `/grievances`, `/help`, `/people`, `/planner`, `/settings`, `/snacks`, `/steps`, `/wifi`. `/leave` and `/away` redirect to Attendance. Root layout, employee gates, onboarding, desktop/mobile workspace branches, shared dialogs and notifications were included.

Excluded from behavioral verification: actual browser journeys, physical Android/iOS performance, production Google OAuth, Zoho responses/scopes, push provider delivery, production database queries, backup restoration, and production smoke tests. These remain deferred under the owner's earlier instruction to do verification later. Static typecheck and dependency advisory lookup were performed. Decorative assets, every animation frame, and every primitive component were not exhaustively inspected. This report claims complete **entry-point accounting**, not exhaustive runtime correctness or a defect-free product.

Status in the matrix means source wiring only: **wired** = a consumer and implementation are traced; **gap** = a finding below; **optional** = outside the required v0 scope. Every row remains runtime-unverified in this audit.

## Blocking findings

### B1 - Private push subscriptions survive sign-out and account switching

**Source-confirmed defect; high privacy impact.** Persona/trigger: employee A enables push, then signs out or switches to B on the same browser. Expected: that browser stops receiving A's private notifications and, when appropriate, binds to B. Actual: `app/api/auth/logout/route.ts:3` only deletes the session cookie; `app/api/auth/google/route.ts:19` clears identity cookies without detaching push. `components/notifications.tsx:38` detects an existing subscription and displays it as on, but does not re-register it for the current identity. Server association is only written by the explicit Turn on action (`app/api/push/route.ts:40`). `lib/push.ts:40` routes by persisted email; `public/sw.js:8` displays the payload without checking the current session.

Consequences: A's private ping body or leave decision can reach a browser now used by B or a signed-out user; B can also miss their own targeted notifications. Clearing the GET cache does not clear this server-side association. Smallest useful fix: bind subscriptions to a revocable browser/session capability, detach targeted delivery on logout and account-switch initiation, rebind existing subscriptions after identity changes, and handle expired sessions. Preserve the separate anonymous-grievance boundary. Verify A -> logout -> B plus session expiry with targeted payloads before release. No live notification was sent to reproduce this.

### B2 - Attendance, declared presence, and pantry eligibility disagree

**Source-confirmed defect; core workflow integrity.** Persona/trigger: an employee checks in through Attendance with office GPS/network proof. Expected: office presence and pantry availability agree across Overview, People and Attendance. Actual: `app/api/attendance/route.ts:113` writes attendance coordinates but never updates workspace presence; `lib/workspace-model.ts:11` requires a same-day profile mode, and `lib/workspace.ts:39` uses that mode for pantry eligibility. A valid office check-in can therefore leave Overview showing not checked in and pantry locked.

The reverse path also disagrees: `app/api/workspace/route.ts:47` writes null coordinates and a declared profile mode; `app/api/people/route.ts:34`, the admin attendance mapping (`app/admin/page.tsx:134`), and the monthly attendance handler (`app/api/attendance/route.ts:55`) classify only coordinates. Choosing In office or Remote can show Location not shared elsewhere. Existing open check-ins are idempotent, so a later declaration can leave old coordinates intact. Related cache gap: `lib/fetcher.ts:88` does not invalidate attendance/snacks GETs for workspace presence writes, or attendance calendar GETs for away decisions.

Smallest useful fix: define one effective presence contract distinguishing declaration from location evidence, update it through both attendance entry paths, and use it for all consumers and invalidation. Keep personal planner status separate. Verify both directions, checkout/re-entry, another device, and the pantry cutoff. This finding does not assume physical-presence enforcement is required; the current product explicitly supports declarations.

### B3 - Leave state transitions are checked outside the persistence operation

**Source-confirmed concurrency defect; interleaving not runtime-reproduced.** Persona/trigger: two coordinators decide one pending request concurrently, or the requester cancels while a coordinator approves. Expected: one permitted transition commits; the competing stale operation gets a conflict and reloads. Actual: `app/api/away/route.ts:122` reads a row, checks its status later, then writes; `lib/pgstore.ts:682` updates solely by ID and `lib/jsonstore.ts:381` also unconditionally replaces status. Both operations can pass the pending check, return success and send incompatible notifications; a stale approval can overwrite a cancellation.

Smallest useful fix: add expected-current-status to the store transition contract and use an atomic conditional update, with matching JSON behavior and concurrency coverage. Return a conflict on a lost transition; send push only for the committed transition. Do not solve this only by disabling UI buttons.

### B4 - Manual leave snapshots can silently discard deductions

**Source-confirmed calculation defect; affects the active manual fallback and admin overview.** Persona/trigger: an admin saves a partial snapshot, leaving a type blank as the UI explicitly permits. Expected: that type continues using policy entitlement minus its app history. Actual: `lib/leave-data.ts:58` excludes all requests created before the snapshot for every type, before `lib/leave-data.ts:63` checks whether that type even has a snapshot. A previously approved one-day CL disappears from the CL ledger when an admin saves only SL. `components/leave-overview.tsx` explicitly tells admins that a blank box keeps policy entitlement.

A second reconciliation gap: an app request pending before snapshot time and approved afterward remains excluded by creation time. Since the app does not submit to Zoho, creation before a copied Zoho figure does not establish that Zoho incorporated it. Snapshot saving can therefore erase valid local usage, and current cancellation copy promising immediate balance restoration is not valid for leave already embedded in a snapshot or a live Zoho balance.

Smallest useful fix: apply snapshot cutoffs per populated type, and explicitly record/reconcile which local requests a copied balance includes. Until reconciliation exists, label local adjustments as estimates and route authoritative decisions to Zoho rather than treating timestamps as proof. Cover partial snapshots, pending-before/approved-after, cancellation, and year-crossing requests.

### B5 - Production database certificate verification is not configured

**Source + current configuration-name evidence; live connection not re-tested.** `lib/pgconfig.ts:22` disables TLS for an explicit disable URL and otherwise defaults certificate verification off unless `DATABASE_CA_CERT` or `DATABASE_SSL_VERIFY=true` is supplied. The current Vercel production project environment-key listing contains `DATABASE_URL` but neither verification key. A trusted CA was supplied by the owner earlier, but that file is not automatically installed into Vercel.

Expected: authenticated TLS to the production database. Impact: the default encrypted connection does not authenticate the database certificate. Smallest useful fix: configure the supplied trusted CA as the production environment value, require verified TLS for nonlocal deployments, and verify the actual deployment's DB connection. A local file path is not a usable Vercel CA value. Environment values, the deployment snapshot, and connectivity must be checked before calling this fixed. No environment was changed by this audit.

### B6 - Current release evidence is incomplete and an existing E2E expectation is stale

**Missing release evidence, plus source-confirmed test drift.** `e2e/zip-design.spec.ts:57` still clicks Phone View, deliberately removed from `components/workspace/nav.tsx` and `portal.tsx`. The desktop test cannot complete unchanged. New whole-team notes, mobile keyboard/dock behavior, and the Zoho adapter have no fresh runtime evidence in this audit. Older passing runs predate these changes. CI's default browser matrix is Chromium desktop/Pixel; WebKit is opt-in through `E2E_IOS` in `playwright.config.ts`.

Smallest useful fix: update the obsolete preview expectation to assert the intended desktop/mobile behavior, add focused coverage for the new audience and identity/error cases, then run current release gates on isolated storage. Run WebKit explicitly for affected iOS changes. Physical smoothness remains a separate device check. Respect the owner's verification deferral now; do not mark this a pass because typecheck succeeds. If live Zoho is included in the release promise, its authorized integration check is an additional gate; it can otherwise remain honestly unavailable.

## Other product and reliability findings

- **A1 - Initial failures leave persistent loading UI.** Source-confirmed: `lib/fetcher.ts:31` catches a failed GET and returns null with a toast. Callers including `app/attendance/page.tsx:47`, `app/people/page.tsx:42`, `app/events/page.tsx:48`, `app/snacks/page.tsx:44`, `app/wifi/page.tsx:102`, `app/settings/page.tsx:32`, `components/leave-panel.tsx:101`, and `components/notifications.tsx:33` retain null and show skeleton/Loading without an inline retry. Expected: a usable error and retry after a transient failure. Add explicit error state and retry per loaded resource, including expired-session reauthentication. This is a release-quality gap under unreliable mobile networks; a page reload is currently the practical recovery. The planner and board already have useful retry patterns.
- **A2 - Auto check-in setting has no mounted executor.** `app/settings/page.tsx:135` saves the preference and claims opening the app will automatically mark attendance. The effect implementing it lives in `components/check-in-card.tsx:97`; that component is no longer mounted by any page/workspace. Expected: enabled setting works on the current landing page. Wire the effect into the owning presence flow after B2, or remove the setting/promise for v0. Importing its storage-key constant does not mount the component.
- **A3 - Expired-session leave chips can crash Overview.** `app/api/leave/route.ts:27` returns `{signedIn:false, year}` when identity is absent. `components/workspace/leave-chips.tsx:11` calls `summary?.ledger.find(...)`, although that response has no ledger. Trigger: the SSR workspace was loaded while signed in but the session disappears before the client GET, including another tab signing out. Handle the response as a discriminated union, guard the ledger, and offer sign-in. Typecheck currently misses this because the GET is asserted to `LeaveSummary`.
- **A4 - Older pending leave can disappear from the coordinator's work queue.** `app/admin/page.tsx:107` loads the newest 50 away rows without pending-status pagination; `app/api/away/route.ts:122` searches only the newest 200 for an update. As history grows, a still-pending request can fall out of the dashboard, and a known older request becomes unmodifiable. Query actionable statuses separately and get a request by ID for decisions; paginate history. This is conditional on volume, not an observed current backlog.
- **A5 - Notification delivery and feed refresh are weaker than the copy suggests.** `components/notifications.tsx:38` loads once; opening the bell does not fetch fresh data, so an already-open tab can miss a new decision until navigation/reload. `lib/notifications.ts` timestamps grievance status items by submission creation time, so a decision after Last seen may not become unread. Urgent Speak Up success copy says admins get pinged even when push is unconfigured or delivery fails (`app/api/grievances/route.ts:71`, `lib/push.ts:38`). Persisting the report works, but receipt is not proven. Refresh on open/focus, use a real status-change timestamp without introducing an identity join, and keep delivery copy best-effort unless receipt is known.
- **A6 - RSVP identity is intentionally browser-scoped.** `app/api/events/route.ts:122` and store keys use the device reference. A signed-in employee can count twice across devices, and B inherits A's RSVP toggle on the same browser. Help promises only a headcount, so this is an advisory product decision rather than an unauthorized-data disclosure. If organizers expect one RSVP per employee, use verified account ownership with an explicit guest policy.
- **A7 - Mobile usability and installation remain unproven.** Source includes safe areas, visual viewport handling, reduced motion, labeled dock actions, focus return on card collapse and Radix dialogs. These are useful implementation measures, not evidence of smooth scrolling, keyboard correctness or physical performance. `components/ping-sheet.tsx` uses a custom modal without a focus trap/initial focus/restoration. `app/manifest.ts` has an empty icons array; a polished install experience needs proper icons and device verification. Review cold start, slow network, keyboard, rotation, 320px width and long names on Android and iOS.

## Forward coverage matrix

Evidence below names the owning source chain. All persisted app rows go through the corresponding implementations in `lib/jsonstore.ts` and `lib/pgstore.ts`; provider/cache-only operations are named explicitly. Reload/return behavior was traced in code, not exercised.

| Operation and persona | UI entry/action | Backend method/server action | Store/provider | State and recovery | Evidence | Status/gap |
| --- | --- | --- | --- | --- | --- | --- |
| Guest starts sign-in | Onboarding / Settings / Switch | GET auth/google | Google OAuth state cookie | Redirect; failure to Settings | onboarding.tsx -> google route -> lib/google.ts | Wired; B1 lifecycle |
| Employee completes sign-in | Google redirect | GET auth/callback | Google token exchange + upsertEmployee/setRole | Signed cookie, next redirect; failure reason | callback route -> lib/auth.ts/google.ts | Wired; live OAuth unverified |
| Employee reads identity | Settings / Attendance / leave | GET auth/me | getEmployee | signedIn false vs identity; failed load skeleton | settings/page.tsx -> me route | A1 |
| Employee signs out | Account menu / Settings | POST auth/logout | Cookie only | Cache clears; refresh/full navigation | workspace/nav.tsx, settings/page.tsx -> logout | B1 |
| Coordinator PIN login | AdminLogin | POST admin/login | HMAC admin cookie; IP/global limiter | Error/locked; redirect or JSON | admin-login.tsx -> login route | Wired; process-local limiter |
| Coordinator PIN logout | Admin form | POST admin/logout | Admin cookie only | Redirect; Google admin session remains valid | admin/page.tsx -> logout route -> lib/admin.ts | Wired; sign-out label should clarify scope |
| Employee workspace read | /, /steps, /planner; idle refresh | SSR workspaceData + GET workspace | Employees/profiles/attendance/orders/steps/events/board/Wi-Fi | SSR; 30s idle/focus refresh, last data on failure | workspace/page.tsx -> portal.tsx -> lib/workspace.ts | B2; runtime deferred |
| Employee edits profile/status | Profile editor / arena broadcast | PATCH workspace | saveWorkspaceProfile | Error preserves form; reload workspace | profile.tsx/arena.tsx -> workspace route | Wired |
| Employee declares office/remote/out | Presence controls / pantry unlock | POST workspace | checkIn/checkOut + saveWorkspaceProfile | Busy, response, reload | portal.tsx -> workspace route | B2; two writes not atomic |
| Employee reads today attendance | Attendance Today | GET attendance | getAttendance/listAttendance | Identity gate; skeleton on failed read | attendance/page.tsx -> lib/today.ts | B2, A1 |
| Employee reads own month | Attendance Calendar | GET attendance?month | listAttendanceRange/listAwayByEmail | Month paging; no failure retry | attendance-calendar.tsx -> attendance route | B2, A1 |
| Employee checks in/out | Attendance main action | POST attendance | getAttendance/checkIn/checkOut | GPS best-effort, validation, reload | attendance/page.tsx -> attendance route | B2 |
| Employee forgets identity | Attendance Not you | DELETE attendance | Identity/email cookies | Page refresh, cache clear | attendance/page.tsx -> attendance route | B1 lifecycle |
| Employee sees directory/presence | People / arena | GET people; SSR/GET workspace | listEmployees/listAttendance; profiles for arena | Signed-in gates, no raw coordinates in directory | people/page.tsx -> people route; arena.tsx | B2, A1 |
| Owner grants/revokes admin | Admin Access | PATCH people role | getEmployee/setRole | Owner check, owner protected; refresh | access-list.tsx -> people route | Wired |
| Admin edits joining date | Admin People | PATCH people joinedOn | setJoinedOn | Refresh; format-only date validation | leave-overview.tsx -> people route | Wired; strengthen calendar validation |
| Admin imports step offset | Admin People | PATCH people stepsOffset | setStepsOffset | Whole-number validation; refresh | leave-overview.tsx -> people route | Wired |
| Employee reads own pantry tray | Overview / Snacks Today | GET snacks?scope=mine; workspace read | listOrders/pantryRef + presence | Office lock, cutoff and max four; reload | pantry.tsx, snacks/page.tsx -> snacks route | B2 |
| Employee reads order history | Snacks History | GET snacks?scope=history | listOrdersByRef | Account ownership; legacy device fallback; empty | snacks/page.tsx -> snacks route | Wired; history initial failure A1 |
| Coordinator reads consolidated orders | Admin Today | SSR; GET snacks admin equivalent | listOrders/MENU | Per-item totals, employee trays/instructions | admin/page.tsx -> store; snacks route | Wired; manual fulfillment |
| Employee saves/updates tray | Pantry Add/Remove / Snacks submit | POST snacks | setDayOrders | Auth-derived pantryRef, office eligibility/cutoff/menu/limit; refresh | pantry.tsx/snacks/page.tsx -> snacks route | Wired; B2 eligibility |
| Employee cancels tray | Pantry Clear / Snacks cancel | DELETE snacks | deleteOrder | Cutoff; current account or legacy device; refresh | pantry.tsx/snacks/page.tsx -> snacks route | Wired |
| Guest/employee reads events | Events / workspace card | GET events | listEvents/rsvpCounts/myRsvpEventIds | Empty; API strips creator; failure skeleton | events/page.tsx, workspace/events.tsx -> events route | A1, A6 |
| Employee publishes event | Workspace Add event | POST events JSON | addEvent | Verified user, future time validation; reload | workspace/events.tsx -> events route JSON branch | Wired; no push in JSON branch |
| Admin publishes/deletes event | Admin Publish | POST events form | addEvent/deleteEvent; broadcast push on publish | 303 flash; delete cascades RSVPs | post-composer.tsx/admin -> events form branch | Wired; best-effort delivery |
| Guest/employee toggles RSVP | Events Join / workspace RSVP | PATCH events | getEvent/setRsvp/rsvpCounts | Error; count/mine updates; browser persistence | events UI -> events route | A6 |
| Employee reads board | Overview / mobile Board | GET notices + SSR noticeBoard | listNotices/listNoticeReactions | Filters/empty; reload retry; initial props sync | notice-board.tsx -> lib/notices.ts | Wired |
| Employee posts board/team paper note | Board composer / whole-team recipient | POST notices | addNotice | Named/anonymous; team note explicitly named and retained; errors preserve | notice-board.tsx/notes.tsx -> notices route | Wired; new team path untested |
| Employee reacts to board note | Reaction control | PATCH notices | toggleNoticeReaction | Supported emoji; missing note error; reload | notice-board.tsx -> notices route | Wired |
| Admin moderates board | Remove board note | DELETE notices | deleteNotice | Verified session + admin; reload | notice-board.tsx -> notices route | Wired; PIN-only without employee cannot use this route |
| Team reads announcements | Overview board / notification | SSR workspace + GET announcements equivalent | listAnnouncements | Persistent content; board includes three recent | lib/workspace.ts, notice-board.tsx, notifications.ts | Wired; headless GET equivalent |
| Admin publishes/deletes announcement | Admin Publish | POST announcements form | addAnnouncement/deleteAnnouncement + push | 303 flash, persisted; best-effort broadcast | post-composer.tsx/admin -> announcements route | Wired; notification hash lacks current board anchor |
| Employee reads ping inbox/thread | People / notification deep link | GET pings; ?with | listPingsFor/getEmployee | Current participant only; 24h filter, thread polling | people/page.tsx, ping-sheet.tsx -> pings route | Wired; A1/A7 |
| Employee sends private note/wave | Paper note / arena / PingSheet | POST pings | getEmployee/addPing; targeted push | Verified sender, target exists, max length; error retention | notes.tsx/arena.tsx/ping-sheet.tsx -> pings route | B1 push; persistence wired |
| Employee marks ping thread read | Open conversation | PATCH pings | markPingsRead | Recipient-specific update; feed invalidated | ping-sheet.tsx -> pings route | Wired; unread UI refresh A5 |
| Employee reads personal plans | Planner / pass reverse | GET planner | listPlannerDays | Own account; strict dates/range; retry | workspace/planner.tsx/pass.tsx -> planner route | Wired; not approved leave |
| Employee sets/clears personal plan | Planner status setter | POST planner | setPlannerDay/deletePlannerDay | Strict date/kind, busy; refetch/revisit | planner.tsx -> planner route | Wired |
| Employee reads leave summary | Attendance Leave / chips | GET leave | getEmployee/listAwayByEmail/listLeaveBalances + optional Zoho | Manual/policy/live source labels; stale message | leave-panel.tsx/leave-chips.tsx -> leave route | B4, A1, A3 |
| Admin reads leave overview | Admin People | SSR leaveOverview; GET leave?scope=overview equivalent | listEmployees/listAway/listLeaveBalances | Admin only; local snapshot overview | admin/page.tsx -> lib/leave-data.ts | B4 |
| Admin records balance snapshot | Admin Edit balances | PATCH leave | setLeaveBalance | Half-day amounts; asOf now, attribution, refresh | leave-overview.tsx -> leave route | B4 |
| Employee reads own requests | Attendance Your requests | GET away?scope=mine | listAwayByEmail | Verified account across devices; newest 30 | leave-panel.tsx -> away route | Wired; A1; bounded history |
| Admin reads requests | Admin Approvals | SSR + GET away admin equivalent | listAway | Admin gate; newest 50 SSR /100 API | admin/page.tsx -> store; away route | A4 |
| Employee requests leave/WFH | Attendance Leave form | POST away | addAway + pure leaveCost | Signed email, type/span/half-day validation; pending, reload | leave-panel.tsx -> away route -> lib/leave.ts | Wired locally; not Zoho submission |
| Admin decides request | Approvals Approve/Reject | PATCH away | setAwayStatus + targeted push | Admin; pending check; optimistic rollback | away-list.tsx -> away route | B3, A4, B1 |
| Employee/admin cancels request | Your requests; API supports admin | PATCH away cancelled | setAwayStatus + targeted push | Ownership/admin, pending/approved, end-date bound | leave-panel.tsx -> away route | B3/B4; no admin cancel control |
| Guest reads own anonymous reports | Speak Up history / notification | GET grievances?scope=mine | Cookie-held IDs -> listGrievancesByIds | No employee join; only this browser | grievances/page.tsx -> submitter.ts | Wired; capability intentionally device-scoped |
| Admin reads reports | Admin Approvals | SSR + GET grievances equivalent | listGrievances | Admin, refs stripped; urgent first | admin/page.tsx -> grievance-list.tsx | Wired |
| Guest/employee submits report | Speak Up | POST grievances | addGrievance forced anon; urgent admin push | Body/photo limits, device/IP limit; own IDs cookie | grievances/page.tsx -> grievances route | Wired; urgent receipt copy A5 |
| Admin updates report | Admin status select | PATCH grievances | setGrievanceStatus | Admin; optimistic rollback; reload | grievance-list.tsx -> grievances route | Wired; notification timing A5 |
| Guest/employee reads notifications | Bell | GET notifications | Derived announcements/events/own away/pings/capability reports | Empty/loading; per-browser seen marker | notifications.tsx -> lib/notifications.ts | A1, A5 |
| Guest/employee marks feed seen | Opens bell | POST notifications | Last-seen cookie only | UI clears unread without checking response | notifications.tsx -> notifications route | A5; false read-state on failed write |
| Browser reads push settings | Bell Turn on | GET push | VAPID public key/config status | Unsupported/denied/off/on | notifications.tsx -> push route | Wired |
| Browser enables push | Bell Turn on | POST push | savePushSubscription | Endpoint allowlist, signed email or null | notifications.tsx -> push route | B1 lifecycle |
| Browser disables push | Bell Turn off | DELETE push | deletePushSubscription; browser unsubscribe | API result ignored before success UI | notifications.tsx -> push route | Wired; strengthen failure reporting |
| Employee reads steps/rankings | Steps / Overview summary | SSR workspace; GET steps equivalent | listSteps/listEmployees -> stepsBoard/rankings | Own recent logs + team board; authenticated API | workspace/steps.tsx -> workspace; lib/today.ts | Wired; data grows without paging |
| Employee logs steps | Steps Save today | POST steps | setSteps | Session, today-only, count bounds; workspace refetch | workspace/steps.tsx -> steps route | Wired; input draft not synced on external update |
| Guest/employee reads Wi-Fi | Wi-Fi; Overview latest | GET wifi / workspace | listWifi | Latest/recent, no reports empty; error skeleton | wifi/page.tsx -> wifi route | A1 |
| Guest/employee reports Wi-Fi | Good/Poor | POST wifi | addWifi | Per-device/IP limits, speed validation, reload | wifi/page.tsx -> wifi route | Wired |
| Browser discovers speed targets | Check Speed | GET wifi/speedtest/targets | Fixed fast.com adapter | 4s timeout, allowed CDN URLs, empty fallback | wifi/page.tsx -> targets route | Wired; best-effort undocumented provider |
| Browser fallback speed download | Check Speed fallback | GET wifi/speedtest | Fixed 2MB payload | Rate limit, streamed timing/error | wifi/page.tsx -> speedtest route | Wired; measures server hop |
| Employee toggles auto check-in | Settings | No mounted execution path | localStorage only | Success toast; no attendance change on current home | settings/page.tsx -> dormant CheckInCard | A2 |
| Any visitor reads help | Help | Server-rendered FAQ/config | orderCutoffHour only | Static guidance with runtime cutoff | help/page.tsx | Wired; reconcile wording with current flows |

## Reverse coverage

All 50 route methods appear in the matrix, including query/content-type branches. Legitimate backend-only or duplicate-read cases:

- `GET auth/callback`: Google redirect consumer, not a button that should directly call it.
- `GET announcements`, admin-scoped `GET snacks`, admin-scoped `GET away`, `GET grievances`, `GET leave?scope=overview`: current screens can render the same owning store/helper directly on the server. Their HTTP read equivalents are not missing frontend features.
- `GET steps`: legacy StepsCard consumer is dormant; current Steps uses workspace aggregation calling the same `stepsBoard` helper. The endpoint is an equivalent authenticated read surface, not a release requirement to add another screen.
- `sendPush` -> registered browser endpoint -> `public/sw.js`: intended external browser consumer. B1 concerns its identity lifecycle, not the absence of a page.
- Fast.com target lookup and fallback payload: consumed by the speed measurement algorithm, not separate pages.
- Zoho adapter: called only by authenticated personal leave GET. No background sync or provider mutation exists; the cache is process-local and ephemeral.
- Database schema initialization/migrations: internal `PgStore.init` consumer. No UI required. Backup/restore and cold-start behavior were not exercised in this audit.

Store accounting: all 59 contract methods have JSON and PostgreSQL implementations. 57 have direct application callers; among those, `listAwayByRef` is reachable only through the unused legacy `awayForDevice` helper. `listStepsByEmail` and `listRsvps` have no application caller. These are dormant helpers, not missing required screens. Help deliberately promises RSVP counts without attendee identities. Do not expose attendee identities merely to consume `listRsvps`.

Legacy components `check-in-card.tsx`, `steps-card.tsx`, `quick-order.tsx`, `speak-up-card.tsx`, and `nav.tsx` are not current page entry points. Their replacement flows are mapped above. CheckInCard's still-advertised preference executor is the verified exception A2.

## Providers and release operations

- **Zoho:** adapter/UI written, not connected or provider-verified. Current Vercel production key inventory has no `ZOHO_*` keys. Missing connection is honestly displayed, with manual/policy fallback. Explicit employee/type mapping, server-only credentials, regional host allowlist, pagination, unsafe numeric ID handling, units, timeout and stale states exist in source. Read-through results are separate from local approvals. Submission is not implemented; approval API suitability remains unconfirmed. Do not promise organization-wide leave sync or provider approval. If activated, validate actual organization date format, records/balance contracts, scopes and quotas with authorized fixtures before release.
- **Snacks:** internal selections and coordinator dashboard are implemented. There is no Instamart/Blinkit adapter, provider checkout, payment, inventory or order-status reconciliation in the application. Existing research documents do not establish integration. Keep the v0 fulfillment promise explicitly manual.
- **Google:** production key names exist; live sign-in, approved callback URLs and current authorization were not tested. Local mock tests cannot establish these.
- **Push:** production VAPID key names exist; delivery, iOS installation conditions and permission recovery are unverified. Best-effort sends are not delivery receipts.
- **Durability:** deployed store selects PostgreSQL, refuses missing DATABASE_URL on Vercel, and test config explicitly forces isolated JSON files or supplied test DB. Do not run E2E against an inherited production URL: setup truncates all public tables in E2E_DATABASE_URL. Production backup/restore readiness remains unreviewed.
- **Operations:** security headers, server-side role checks, identity-derived writes and anonymous-ref scrubbing are present. Rate limits and Zoho caches are process-local; no fleet-wide protection or centralized provider-error telemetry was established. These are operational follow-ups, not proof of a currently exploited failure.

## Checks and next release gate

Fresh audit results:

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run typecheck` | PASS, exit 0 | Current working tree compiles under TypeScript checking |
| `npm audit --audit-level=high` | PASS, exit 0, 0 vulnerabilities | Current npm advisory result for this lockfile; not a code security audit |
| `git diff --check` | PASS, exit 0 | No whitespace errors in tracked changes |
| Read-only Vercel project/deployment metadata | READY at HEAD; no CA verification or Zoho key names | Current metadata boundary, not provider functionality |
| Unit/store, build, E2E, WebKit, device/provider checks | DEFERRED | No fresh runtime readiness claim |

Recommended repair order: B1 privacy -> B2 shared presence -> B3 atomic leave transitions -> B4 reconciliation -> B5 verified TLS -> failure/expiry recovery and stale test expectations. Do not grow scope into ordering-provider or Zoho write integrations to release v0.

After authorized fixes, run `npm run typecheck`, `npm test` with a dedicated local TEST_DATABASE_URL for store changes, build, targeted feature suites, then the required full E2E gate and PostgreSQL matrix for store/SQL changes. Run `E2E_IOS=1` WebKit explicitly for mobile changes. Review changed coverage without weakening desired behavior. Verify first use, repeat use, offline recovery, account A/B, cross-device account state, coordinator receipt/decision, reload persistence and anonymous-report isolation.

Only then follow the repository PR-only merge workflow. Pushing/merging and deploying require the owner's applicable approval; this audit did neither. Before claiming production readiness, configure verified DB TLS, confirm the deployed revision, and complete the authorized production smoke scope. Keep physical-device smoothness and optional live Zoho authorization as separately evidenced claims.

## Store caller appendix

This reverse index accounts for the 59 contract methods. A direct caller is source reachability, not proof that its enclosing helper is mounted. Implementations are in both stores; the dormant exceptions are described above.

| Store method | Direct application caller(s) |
| --- | --- |
| `addNotice` | `app/api/notices/route.ts` |
| `listNotices` | `lib/notices.ts` |
| `deleteNotice` | `app/api/notices/route.ts` |
| `toggleNoticeReaction` | `app/api/notices/route.ts` |
| `listNoticeReactions` | `lib/notices.ts` |
| `getWorkspaceProfile` | `lib/workspace.ts` |
| `listWorkspaceProfiles` | `lib/workspace.ts` |
| `saveWorkspaceProfile` | `app/api/workspace/route.ts` |
| `setPlannerDay` | `app/api/planner/route.ts` |
| `deletePlannerDay` | `app/api/planner/route.ts` |
| `listPlannerDays` | `app/api/planner/route.ts` |
| `checkIn` | `app/api/attendance/route.ts`, `app/api/workspace/route.ts` |
| `checkOut` | `app/api/attendance/route.ts`, `app/api/workspace/route.ts` |
| `getAttendance` | `app/api/attendance/route.ts`, `lib/workspace.ts`, `lib/today.ts` |
| `listAttendanceRange` | `app/api/attendance/route.ts` |
| `listAttendance` | `app/admin/page.tsx`, `app/api/people/route.ts`, `lib/workspace.ts`, `lib/today.ts` |
| `setSteps` | `app/api/steps/route.ts` |
| `listSteps` | `lib/workspace.ts`, `lib/today.ts` |
| `listStepsByEmail` | None; dormant |
| `setDayOrders` | `app/api/snacks/route.ts` |
| `listOrders` | `app/admin/page.tsx`, `app/api/snacks/route.ts`, `lib/submitter.ts`, `lib/today.ts` |
| `listOrdersByRef` | `app/api/snacks/route.ts`, `lib/submitter.ts` |
| `deleteOrder` | `app/api/snacks/route.ts`, `lib/submitter.ts` |
| `addGrievance` | `app/api/grievances/route.ts` |
| `setGrievanceStatus` | `app/api/grievances/route.ts` |
| `listGrievances` | `app/admin/page.tsx`, `app/api/grievances/route.ts` |
| `listGrievancesByIds` | `lib/submitter.ts` |
| `addPing` | `app/api/pings/route.ts` |
| `listPingsFor` | `app/api/pings/route.ts`, `lib/notifications.ts` |
| `markPingsRead` | `app/api/pings/route.ts` |
| `addWifi` | `app/api/wifi/route.ts` |
| `listWifi` | `app/admin/page.tsx`, `app/api/wifi/route.ts`, `lib/workspace.ts` |
| `addAnnouncement` | `app/api/announcements/route.ts` |
| `deleteAnnouncement` | `app/api/announcements/route.ts` |
| `listAnnouncements` | `app/admin/page.tsx`, `app/api/announcements/route.ts`, `lib/workspace.ts`, `lib/notifications.ts` |
| `addAway` | `app/api/away/route.ts` |
| `setAwayStatus` | `app/api/away/route.ts` |
| `listAway` | `app/admin/page.tsx`, `app/api/away/route.ts`, `lib/leave-data.ts` |
| `listAwayByRef` | `lib/submitter.ts` |
| `listAwayByEmail` | `app/api/attendance/route.ts`, `app/api/away/route.ts`, `app/api/leave/route.ts`, `lib/notifications.ts` |
| `addEvent` | `app/api/events/route.ts` |
| `getEvent` | `app/api/events/route.ts` |
| `deleteEvent` | `app/api/events/route.ts` |
| `listEvents` | `app/admin/page.tsx`, `app/api/events/route.ts`, `lib/workspace.ts`, `lib/notifications.ts` |
| `setRsvp` | `app/api/events/route.ts` |
| `listRsvps` | None; dormant |
| `rsvpCounts` | `app/admin/page.tsx`, `app/api/events/route.ts`, `lib/workspace.ts` |
| `myRsvpEventIds` | `app/api/events/route.ts` |
| `upsertEmployee` | `app/api/auth/callback/route.ts` |
| `getEmployee` | `app/api/people/route.ts`, `app/api/pings/route.ts`, `app/api/leave/route.ts`, `app/api/auth/me/route.ts`, `lib/admin.ts` |
| `listEmployees` | `app/admin/page.tsx`, `app/api/grievances/route.ts`, `app/api/away/route.ts`, `app/api/people/route.ts`, `app/api/pings/route.ts`, `lib/workspace.ts`, `lib/notifications.ts`, `lib/today.ts`, `lib/leave-data.ts` |
| `setRole` | `app/api/people/route.ts`, `app/api/auth/callback/route.ts` |
| `setJoinedOn` | `app/api/people/route.ts` |
| `setStepsOffset` | `app/api/people/route.ts` |
| `setLeaveBalance` | `app/api/leave/route.ts` |
| `listLeaveBalances` | `app/api/leave/route.ts`, `lib/leave-data.ts` |
| `savePushSubscription` | `app/api/push/route.ts` |
| `deletePushSubscription` | `app/api/push/route.ts`, `lib/push.ts` |
| `listPushSubscriptions` | `lib/push.ts` |
