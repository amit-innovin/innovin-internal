# Production readiness - October 26, 2026

Status: local release candidate verified. Production release requires approval to
apply the verified database CA configuration, ship through a PR, and deploy.

## Changes prepared locally

- Updated Next.js 16.3.5 to 16.4.3, Vitest to 5.0.5, shadcn to 4.22.1,
  and compatible transitive packages. Owner approved the security exceptions to
  the seven-day release-age policy. npm audit: 14 advisories before, zero after.
- Closed OAuth redirects that become external URLs after browser normalization.
- Required verified employee sessions for attendance, calendar and directory APIs.
  Leave/WFH submissions also require the verified requester, including direct API
  calls around the page gate. Remembered email cookies and typed emails cannot
  substitute for Google identity.
- Added sign-in gates on Attendance and People with a return to the requested page.
- Restricted push registration and delivery to browser push-service destinations,
  including validation before contacting previously saved subscriptions.
- Invalidated derived leave-balance cache after request mutations. Browser tests
  exposed stale pending balances; a unit regression reproduced and verifies the fix.
- Scoped leave history and cancellation to the verified employee across devices;
  signing out or switching accounts cannot retain another employee's leave access.
- Required sign-in on the steps API to avoid bypassing directory privacy.
- Protected cached and in-flight GETs across writes and identity changes. Regressions
  cover stale balances and the old-employee pending-response race after logout.
- Aligned the phone Wi-Fi shortcut with the desktop automatic speed-check action.
- Preserved navigation for break-glass administrators on the onboarding page.
- Updated existing browser tests for verified sign-in and the actual workspace UI.

## Verification

- Production build: passed on Next.js 16.4.3.
- Typecheck: passed.
- Unit and JSON/Postgres contracts: 168 passed, no skips.
- npm audit --audit-level=high: zero vulnerabilities.
- Targeted attendance, sign-in and directory browser checks: 13 passed.
- Full JSON-backed browser/API matrix: 214 passed (4.4 minutes).
- Full Postgres-backed browser/API matrix: 215 passed (4.4 minutes), including
  the final leave/steps access guards and account-switch regression.
- Final build after the pending-request cache fix: 108 affected desktop/mobile/API
  and iPhone checks passed (1.5 minutes), including 15 WebKit tests over three
  iPhone sizes. The full matrices above precede only the final pending-request
  cache fix; its regressions also passed directly at the client boundary.
- Earlier targeted JSON API/leave run after the POST identity guard: 64 passed.
- Fresh iPhone SE wallet screenshot inspected; layout and controls are readable.
- Independent read-only review: no remaining blocking findings.
- Source review: no store schema changes. Existing PRODUCT.md edits and the
  untracked PDF are owner work and were preserved.

## Live observations (read-only)

The linked Vercel project is innovin-internal. The production deployment is READY
at commit aded2499a97606604e495a5ebafce9eb76b8bb9c, with alias
https://innovin-internal.vercel.app. This proves the older deployment is served;
the local changes above are not deployed.

- Guest GET /api/people: HTTP 200 on the existing deployment.
- Guest GET /api/attendance: HTTP 200 on the existing deployment.
- Home: HTTP 200, CSP, HSTS, DENY framing and nosniff present.
- Production environment keys for Postgres, Google OAuth, session signing,
  owners, geofence and push are present. Values were not exposed. Presence of
  keys does not prove valid credentials, strong secrets or successful delivery.
- A certificate-verifying database connection failed with
  SELF_SIGNED_CERT_IN_CHAIN before SQL execution. No database rows were changed.
  The owner supplied Downloads/prod-ca-2021.crt from Supabase. A second read-only
  connection with that CA succeeded, including certificate and hostname verification.
  DATABASE_CA_CERT and DATABASE_SSL_VERIFY are absent from the production key list;
  lib/pgconfig.ts currently defaults to encryption without certificate verification.

## Required before release

1. Set DATABASE_CA_CERT in Vercel production to the owner-supplied PEM certificate.
   The certificate was obtained from Supabase Database Settings > SSL Configuration.
   The existing pgConfig implementation enables certificate and hostname checks
   when this is set. A read-only SELECT with that CA already succeeded locally.
   Do not trust a certificate merely copied from an unverified server connection.
   Reference: https://supabase.com/docs/guides/platform/ssl-enforcement
2. Local verification and independent source review are complete. Review the PR
   diff, excluding the owner's unrelated PRODUCT.md edits and PDF.
3. With explicit owner authorization, commit only this change, push the fresh
   branch, open and merge a PR, then deploy. AGENTS.md forbids direct main pushes.
4. Verify real Innovin Google sign-in, sign-out, role enforcement, guest API 401s,
   attendance and pantry persistence against the new deployed commit. Any smoke
   rows require authorization and cleanup. Mocked OAuth is not live OAuth evidence.
5. Confirm database backup/restore ownership and operational monitoring before
   widening rollout. Neither backups, restore recovery nor push delivery was
   established by the local checks.

## Boundaries retained

Anonymous grievances remain available without employee sign-in and never gain an
identity/subscription link. Leave/WFH submissions also require sign-in. General announcements, events and Wi-Fi
retain their existing public read behavior. Leave history and cancellation are
scoped to verified employees across devices; the steps API also requires sign-in. Rate limits remain
per instance. These are explicit remaining exposure/operations considerations,
not guarantees of an organization-wide authentication boundary.

## Verification lessons

The request cache needs invalidation at derived-resource boundaries: an away-request
write changes the leave-balance endpoint as well as request history. The new regression
test protects that behavior. Browser assertions must exercise the actual mobile
Notice Board and expanded event card; checking hidden or unmounted content does not
establish whether an employee can reach it. Existing calendar-policy cases now browse
to their explicit reference month instead of assuming the current month is September.

## Release handoff

Branch: production-readiness-oct26, created fresh from origin/main. At audit
completion, no commit, push, merge, deployment or production environment mutation
had been performed. The owner subsequently authorized pushing this branch. GitHub CLI
still cannot resolve the private repository using its current account. The work-account
SSH fetch succeeds; use the authorized web PR fallback or fix CLI account access before
release. Deploy from a clean checkout of the merged commit so the owner's untracked PDF
and unrelated local PRODUCT.md edits are not accidentally uploaded.

Suggested PR title: Require employee identity and harden production security.
PR summary: closes guest attendance, directory, steps and leave identity paths;
protects OAuth redirects and push destinations; fixes stale balances and cross-account
in-flight cache responses; updates vulnerable dependencies and the regression matrix.

## Local evidence artifacts

- Full JSON: /tmp/innovin-readiness-json-e2e.log
- Full Postgres: /tmp/innovin-readiness-postgres-e2e.log
- Final affected flows plus iPhones: /tmp/innovin-readiness-final-e2e.log
- Screenshots: output/playwright/ios-wallet-ios-small.png and corresponding ios,
  ios-large, pantry, calendar, planner and steps images (gitignored).
- Final npm run build compiled Next.js 16.4.3 and completed its TypeScript gate.
- Final unit command used TEST_DATABASE_URL pointing to the isolated local
  innovin_readiness_test database: 12 test files, 168 tests, no skips.
- git diff --check passed. No production data was created by this audit.
