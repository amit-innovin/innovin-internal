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
- Every screen is built from the Material 3 canvas, not from spec prose: https://claude.ai/artifact/NRpZBjTSvvoWB2yJNuTy7e
  (pages "Member app" and "Admin app"). The board files live in `docs/design/m3/` and are published from there, with the
  route map in its README. Read the board before planning or building a screen. If a state is not drawn, draw it on the
  canvas first; don't invent it in code. Change a board by editing its file and republishing it to the canvas.
- Member screens live in `app/(member)/(m3)/` and render inside `components/m3/app-shell.tsx`; the admin app lives in
  `app/(admin)/admin/(m3)/` with `components/admin-app/shell.tsx`. UI uses the primitives in `components/m3` (and
  `components/admin-app/ui.tsx`) and the tokens and classes in `app/m3.css`. A page wraps its content in
  `className="m3 m3-page"` (font, colours, grey ground, column width).
- Tappable means a filled, tonal or outlined button, or a row with a chevron; flat means information. Lappy appears only where
  the canvas draws it (Home header, Sign in, celebrations, empty states), never on attendance, leave or reminders.
- No vanity numbers or explainer copy: show a number only when it drives an action; headcounts are admin-only.

## Conventions
- `components/ui` keeps only the toast and tooltip primitives; `app/globals.css` holds Tailwind and their tokens.
- Client network calls go through `lib/fetcher.ts` — never raw `fetch` + `res.json().error`.
  Rebuilt screens read server data with TanStack Query: hooks and query keys live in `lib/queries.ts`, use `fetchJSON` as the
  query function and `send` + `readError` in mutations, and update or invalidate the query cache after a write. No Zustand or
  other client store; filters and tabs belong in the URL.
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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
