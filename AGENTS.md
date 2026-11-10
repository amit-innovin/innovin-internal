# Agent notes — innovin-internal

## Commands
- Dev: `npm run dev` (http://localhost:3000; admin = Google sign-in with your email in `ADMIN_EMAILS` in `.env.local`)
- Typecheck: `npm run typecheck` (check the exit code — `tsc` prints errors but a chained `&& echo` can hide them)
- Unit + store contract: `npm test`; add `TEST_DATABASE_URL=postgres://…` to include the Postgres contract
- E2E: `npm run test:e2e` (builds, then Playwright on port 3210).
  `E2E_DATABASE_URL=postgres://…` runs against Postgres; `CHROME_PATH=/path/to/chromium` avoids the Playwright browser download.
  `E2E_MOCK_PORT=3998` moves the Google sign-in mock off port 3999 when another checkout or session is already using it.
- Full gate: `npm run test:all`

## How much to verify, and when
The full e2e matrix is ~150 tests × 2 browser projects × 2 storage backends and takes minutes.
Don't run it after every edit. Instead:
- While iterating: `npm run typecheck`, `npm test`, and only the affected spec
  (`npx playwright test leave.spec.ts --project=desktop`).
- Before merging: one full `npx playwright test`, plus a second run with `E2E_DATABASE_URL`
  only when the change touched SQL or the store.
- Don't re-run a suite that already passed unless the code under it changed.

## Local Postgres for tests (macOS/Homebrew)
```bash
PG=/opt/homebrew/opt/postgresql@17/bin
$PG/initdb -D /tmp/innovin-pg -U postgres --auth=trust
$PG/pg_ctl -D /tmp/innovin-pg -o "-p 54329 -k /tmp" -l /tmp/innovin-pg.log start
$PG/psql -h 127.0.0.1 -p 54329 -U postgres -c "CREATE DATABASE innovin_test" -c "CREATE DATABASE innovin_e2e"
```

## Branch & release workflow
One branch per change, always cut fresh from `main` — never reuse a long-lived branch
(`production-readiness` is retired; it drifted behind `main` for many merges).

```
git checkout main && git pull        # start from the merged state
git checkout -b <short-change-name>  # one branch per change
# …work, then the full gate (typecheck + npm test + e2e on both backends)…
git push -u origin <branch>
gh pr create … && gh pr merge …      # every branch ships via a PR — REQUIRED
git checkout main && git pull        # next change starts here again
```

Per the owner's instruction: every committed branch MUST ship as a pull request that is
then merged into `main`. Never merge to `main` locally or push to `main` directly.

Git access: use the `gautham-inv` GitHub account for every push, PR and `gh` call (owner instruction).
`gh` has more than one account logged in; check `gh auth status` shows `gautham-inv` as active, and
`gh auth switch -u gautham-inv` if not. It has write access to `amit-innovin/innovin-internal`, so
`gh pr create` works. Pushing, opening and merging a PR each need the owner's go-ahead; never
self-merge to `main`.

Then deploy (`npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`, token in `.env`),
smoke-test production, and delete any test rows created by the smoke test.

## Design: the canvas is the source of truth
- Every screen is built from the design canvas, not from spec prose: https://claude.ai/artifact/DEsTmRtTRB5vP2G5ugddyE.
  A snapshot of its boards is in `docs/design/canvas/`; `docs/design/canvas-map.md` maps each board to routes, components and APIs.
  Read the board (and refresh the snapshot if the canvas changed) before planning or building a screen. If a state is not drawn,
  add a board first; don't invent it in code.
- The app is being rebuilt screen by screen. Rebuilt screens live in `app/(member)/(duo)/` and render inside the new shell
  (`components/shell/app-shell.tsx`); `lib/nav.ts` lists which routes those are. Everything else still uses the legacy nav and CSS.
  When a screen is rebuilt: move its route into `(duo)`, add it to `DUO_ROUTES` and point its nav item at it in `lib/nav.ts`.
- New-design UI uses the Duo primitives in `components/duo` and the classes and tokens in `app/duo.css` (all scoped under `.duo`),
  and `Lappy` for the mascot. Rule: a solid bottom edge means tappable, flat means information. Don't use the legacy
  stylesheets or shadcn styling on a rebuilt screen.

## Conventions
- Legacy UI (screens not rebuilt yet): shadcn/ui primitives in `components/ui`, beUI motion components in `components/motion`, shared blocks in `components/kit.tsx`, transitions.dev CSS in `app/transitions.css`. Brand tokens (innovinlabs.com) live in `app/globals.css`.
- Client network calls go through `lib/fetcher.ts` — never raw `fetch` + `res.json().error`.
  Rebuilt screens read server data with TanStack Query: hooks and query keys live in `lib/queries.ts`, use `fetchJSON` as the
  query function and `send` + `readError` in mutations, and update or invalidate the query cache after a write. No Zustand or
  other client store; filters and tabs belong in the URL. Legacy screens keep `getJSON`/`send` until they are rebuilt.
- API routes parse bodies with `readJSON` (400 on bad input) and apply limits via `enforce` (`lib/guard.ts`).
- Any Store change must be implemented in both `lib/jsonstore.ts` and `lib/pgstore.ts` and covered in `tests/store/contract.ts`.
- Leave rules live in `lib/leave.ts` (pure, unit-tested against the company policy and the 2026
  tracker's own working-day totals). Entitlements come from Employee Leave Policy 3.0: CL 4,
  SL 6, EL 15, FL 2. Balances are **not** authoritative here — Zoho People is, and admins copy
  snapshots in (`leave_balances`); only requests created after a snapshot's `asOf` count on top.
- `data/` is gitignored. Never put data the app reads at runtime there: `vercel deploy` uploads
  the working directory, so it would ship to production while being absent from git and CI.
- Notifications are derived in `lib/notifications.ts` — don't add a notifications table. Push
  lives in `lib/push.ts` and must never send grievance updates; that would require storing a
  grievance→subscription link, which is the join anonymity removed.
- OAuth links must be plain `<a href>`, never `next/link` — a Link prefetches the route and the
  redirect to Google trips the `connect-src 'self'` CSP.
- New dependencies: pin exact versions published ≥ 7 days ago.
