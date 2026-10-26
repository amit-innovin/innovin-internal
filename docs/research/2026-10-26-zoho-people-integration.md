# Zoho People integration boundary

## Current implementation

There is no authorized live Zoho connection yet. The read-only adapter in
lib/zoho-people.ts is implemented but has not been exercised against a provider.
lib/leave-data.ts derives fallback balances from manually
copied leave_balances snapshots plus applicable requests made in this app after
the snapshot. app/api/leave/route.ts exposes the authenticated employee summary and
an admin-only snapshot update. No Zoho environment keys or connected Zoho tool were
found during this pass. Do not label these values as live or synced.

## Owner-approved first slice

Read balances and approved leave from Zoho, match employees by verified work email,
and display the last successful sync time. Zoho remains authoritative. Request
submission/approval through Zoho is a separate workflow and should not be silently
implied by displaying data here.

The official v3 leave-record API supports a read-only scope,
ZOHOPEOPLE.leave.READ, employee filters, approval-status filters, and pagination.
Its documented record response includes employee Zoho IDs, so an authenticated
employee-directory mapping is required before exposing personal balances or
team availability. Team availability should omit private leave reasons.

Source checked October 26:
https://www.zoho.com/people/api/v3/leave-tracker/get-leave.html

Before enabling the live connection, confirm the balance-report contract for this organization's
Zoho edition, employee and leave-type identifiers, response units and timezone,
OAuth data center, refresh token, and account permissions. Keep credentials on the
server, request only the required read scopes, paginate, bound upstream calls and
respect provider rate limits. A failed fetch must preserve the last good snapshot
with an explicit stale/error state; unavailable data must not become zero leave.

Reconcile the current app-only request deductions when introducing authoritative
Zoho balances, so a request represented in both systems is not counted twice.
Do not add a second independent approval system without an explicit product choice.

## Status

The owner approved read-only first and requested research into future submission
and approval. The adapter and private employee UI are implemented locally. No live
OAuth connection is configured. No employee imports, provider leave writes, or
production configuration changes were performed. Tests and live verification were
explicitly deferred by the owner. Typecheck passed.

## Confirmed API contracts

- Booked/balance report (read scope ZOHOPEOPLE.leave.READ):
  https://www.zoho.com/people/api/leave/reports/bookedandbalance.html
- Approved requests via the v2 records endpoint (employee filter, dates, pagination):
  https://www.zoho.com/people/api/get-records-v2.html
- OAuth refresh, organization-specific token and regional accounts hosts:
  https://www.zoho.com/people/api/v3/oauth-steps.html
- Future request creation is documented with ZOHOPEOPLE.leave.CREATE:
  https://www.zoho.com/people/api/v3/leave-tracker/add-leave.html
- Zoho's product supports manager approval, but a suitable leave-approval API and
  Innovin's actual approver permissions were not established in this research.
  Do not infer leave approval support from timesheet or on-duty approval APIs.

## Connection setup

Use an admin-owned Zoho People OAuth application scoped to this organization and
ZOHOPEOPLE.leave.READ. Store ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and
ZOHO_REFRESH_TOKEN only in local/server environment configuration. Do not paste
secrets into chat or commit them. Set ZOHO_DATA_CENTER to the account's suffix
(com, in, eu, com.au or com.cn), and ZOHO_DATE_FORMAT to the organization's format
(dd-MMM-yyyy by default; yyyy-MM-dd, dd-MM-yyyy and MM/dd/yyyy supported).

Set ZOHO_EMPLOYEE_IDS to a JSON map of lowercase verified company email to the exact
Zoho employee erecno. Map each employee once; quote every numeric ID so large values
are preserved. Set ZOHO_LEAVE_TYPE_IDS to the exact CL/SL/EL/FL IDs using the keys
cl, sl, el and fl. Optional ZOHO_PEOPLE_PORTAL_ID scopes the leave-record request.
The adapter fails closed if an identity/type mapping or provider shape is invalid.
A read token must have access to all mapped employees needed for this integration.

Reads are cached by configuration, employee and year for five minutes per instance;
concurrent reads share work. Failed reads retain last good in-memory data for at most
24 hours with a stale label, or fall back to the explicitly manual/policy view.
Cold instances have no historical provider cache. Balances are as of today; approved
records cover the current year and only day-based leave. Hour-based records produce
an unavailable/stale state until a supported unit policy is implemented. There are
bounded provider timeouts, at most five leave pages, and an instance-level request
budget, shared failed-token backoff and a separate token-request budget. This is not a durable background sync or a global cross-instance rate limiter.

The app does not overwrite manual snapshots or subtract local approvals from live
Zoho figures. Existing app requests/approvals remain separate and are labeled that
way. After credentials are installed, verification must check identity isolation,
request paths/date format, organization permissions, zero versus missing fields,
large IDs, multi-page completeness, refresh/revocation, stale display and mobile UI.

## Source review

An independent read-only review found no confirmed identity/data-integrity blockers.
The differing balance and records URL prefixes were checked against their official
API pages and intentionally preserved. Token-refresh failure backoff and request
budget were added after review. Typecheck and diff whitespace checks pass; no
runtime/provider/browser test was run in this owner-deferred verification pass.
