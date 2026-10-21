# Exact supplied frontend with the existing backend

## Source and outcome
The user supplied `innovin-internal 2.zip` and requested its exact frontend in the existing Innovin Internal project, connected to the backend. This archive is the visual source of truth. Retain existing Google-only company authentication, actual employee data, office-only ordering, privacy boundaries, and all existing support/admin routes. Preserve the dirty working tree and keep work local.

## Approach and acceptance
Use the supplied stylesheet and cork assets, translate its markup/interactions to React, and reuse existing workspace, pantry, events, steps, planner, notifications and pings APIs. Do not embed the demo iframe or install its dependencies. Replace the old two-column dashboard with the reference three-column viewport layout: personal pass/arena, cork notice board, steps/pantry/events. Use the wallet card stack and bottom dock on mobile, plus desktop phone preview. Keep Google OAuth as the known exception to the prototype signup form; do not invent people, telemetry, balances, prizes or access credentials.

Public board posts are explicitly visible to all signed-in teammates. Anonymous posts store no author identifier. Private grievances remain private in their existing system and must never be read into the public board. Add notices and per-person reaction toggles through both existing storage adapters and an authenticated API, with bounded input and rate limits. Allow administrator deletion. Feedback is not automatically marked reviewed/actioned.

## Slices and checks
1. Shared notice store contract: persist posts, strip author details for anonymous posts, idempotent per-person reaction toggles, delete. Run red then implement JSON and Postgres adapters and run green.
2. Authenticated notice API and native cork board/composer/filter/reactions. Browser tests cover anonymous read/write denial, verified identity, anonymous persistence, reactions, filter and reload. No private grievance exposure.
3. Exact desktop shell, compact badge/arena, pantry search/cart, actual leave balance chips, original events, phone wallet/cards/dock and preview. Appearance changes use screenshot comparison, not CSS unit tests. Preserve existing functional browser coverage; update navigation only when the new mobile interaction requires expanding a card.
4. Typecheck, unit + both store contracts against isolated local DB, Webpack production build, desktop/mobile affected Playwright suites. Inspect reference and implementation screenshots at desktop and mobile. Review security, API/store parity, failure paths, responsive clipping and existing dirty work preservation.

## Completion boundaries
Report local code and checks independently from deployed state. No commit, push, PR, deployment or production write is authorized. Do not change environment credentials or runtime production data.

## Final local evidence and review
- Typecheck and Webpack production build pass.
- Unit and shared JSON/Postgres contracts: 161 passed, including anonymous note scrubbing, reaction toggles, and exact-loopback OAuth cookie transport.
- Postgres desktop/mobile changed-feature regression: 64 passed across workspace, supplied design, navigation, pantry, steps and events. OAuth uses the isolated mock, not real user credentials.
- Supplied stylesheet matches the archive byte-for-byte. Desktop/mobile reference and implementation screenshots were inspected under ignored `output/playwright/`.
- Safari-compatible WebKit reproduced dropping Secure cookies over HTTP localhost. Auth now permits non-Secure cookies only on exact loopback HTTP origins; HTTPS and deployed hosts keep Secure. Running preview headers were verified. The user's real Google round trip still needs their retry.
- Review fixes: prevent the initial responsive mount from resetting a typed steps count; move profile editing out of the overlapping wallet cards; size the note composer to the viewport; override layered reference mobile-header hiding on support routes. No credentials, production data or private grievance records are included in the public board.
- An exploratory whole-suite invocation was interrupted after old-homepage expectations failed. The final 64-test suite is clean; the full release matrix has not been certified. Merge/deployment readiness is not claimed.
- The user subsequently authorized a GitHub push using `amit-innovin`. A fresh `exact-workspace-design` branch was cut from the fetched current main. Preserve unrelated PRODUCT.md edits and the untracked PDF outside the commit. No production deployment is authorized.

## Lessons from implementation
The original CSS contains important rules inside a cascade layer, so unlayered important overrides do not restore the mobile support navigation. Verify CSS layer precedence with rendered browser behavior. Also gate interactive responsive forms until the viewport branch is known; swapping branches during hydration can discard an already typed value. Regression coverage now exercises those paths.
