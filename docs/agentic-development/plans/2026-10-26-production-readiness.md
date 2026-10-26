# Production readiness - October 26

Source: owner requested production readiness and approved requiring employee sign-in
for directory/presence and attendance. The audit also closes direct guest leave/WFH
submissions that bypassed the protected Attendance page. Review also requires
verified ownership for leave history/cancellation and steps-board reads. Preserve existing PRODUCT.md edits and PDF.

## Scope and decisions

- Upgrade vulnerable runtime/tooling dependencies. Owner approved exceptions to the
  seven-day release rule for Next.js 16.4.3 and remaining security patches.
- Reject OAuth destinations that normalize to an external origin.
- Require verified Google identity for directory/presence and attendance reads/writes, leave/WFH submissions and history/cancellation, and steps-board reads.
  A remembered email or break-glass admin PIN is not employee identity.
- Show an explicit sign-in surface on protected pages. Settings remains accessible.
- Retain anonymous grievances without adding identity links.
- No push, merge, production configuration change, or deployment without approval.

## Slices and acceptance

1. OAuth: unit repro for backslash/control-character redirect, fix shared sanitizer,
   browser round-trip confirms landing on app origin with a valid employee session.
2. Authentication: route tests prove guest and forged-email requests receive 401;
   signed sessions can access their own attendance and directory. Browser tests prove
   guest onboarding, Google sign-in, check-in/out, and account switching.
3. Additional audit findings: restrict push destinations at registration and delivery;
   reproduce and fix stale leave balances and in-flight responses after requests/sign-out; retain break-glass admin
   navigation on the onboarding page. Use regression tests for each affected surface.
4. Dependencies: install explicit patched direct versions and compatible lockfile
   updates; npm audit must report no known vulnerabilities.
5. Verification: typecheck, both store contracts, production build, full Playwright
   JSON suite and Postgres suite, targeted iOS. Diagnose stale assertions against
   actual product code; retain workflow, authorization, and privacy coverage.

## Gates and evidence boundaries

Use npm run typecheck, TEST_DATABASE_URL=... npm test, npm run build,
npx playwright test, E2E_DATABASE_URL=... npx playwright test, and
E2E_IOS=1 npx playwright test --project=ios-small --project=ios --project=ios-large.
Only use isolated local databases. Record commands, counts, unresolved risks and
deployment evidence in a readiness report. Passing local tests does not establish
live OAuth, backups, deployed configuration, or production smoke-test success.
