# Zoho People read-only slice

Owner chose read-only first and requested research into later submission/approval.
Implement the connection path now; live verification needs authorized credentials.

## Boundaries

- Server-only OAuth refresh credentials and fixed Zoho data-center hosts.
- Explicit server-side verified-email to employee-record-ID mapping and CL/SL/EL/FL
  leave-type-ID mapping. Never accept an employee identity from a browser parameter.
- Read-through, per-employee/year cache for balances and approved day-based leave.
  No provider writes, store/schema changes, or production environment changes.
- Keep current manual snapshots intact. Live Zoho figures appear separately and
  replace the fallback balance presentation only when a validated response exists.
  Never subtract local approvals from live Zoho balances or import them as local rows.
- Missing balances stay unknown; errors preserve a bounded-age last good cache with
  a stale label. Do not call absence of configuration or coverage zero leave.
- Approved leave is private to the authenticated employee, omitting reasons/attachments.
- Bound calls, pagination, cached access tokens and instance request budget. Preserve
  large Zoho IDs through JSON parsing. Fail closed on mismatched identity or schema.

## UI and verification

Use the existing /api/leave endpoint, leave chips and Attendance Leave panel.
Show fetched time, source, stale/unavailable/not-connected states and setup guidance.
The source remains manual/app-only when no live connection is available.
Typecheck and source review now. Owner deferred test/browser verification; record
unverified live OAuth, ID mappings, organization permissions, payloads and rate limits.
Later tests must cover identity isolation, precision, missing vs zero balances,
pagination, failure/stale behavior, token refresh, cache isolation and no double counting.

Official contracts: docs/research/2026-10-26-zoho-people-integration.md.
