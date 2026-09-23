# Agent notes — innovin-internal

## Commands
- Dev: `npm run dev` (http://localhost:3000; admin PIN from `.env.local`, local default `1704`)
- Typecheck: `npm run typecheck` (check the exit code — `tsc` prints errors but a chained `&& echo` can hide them)
- Unit + store contract: `npm test`; add `TEST_DATABASE_URL=postgres://…` to include the Postgres contract
- E2E: `npm run test:e2e` (builds, then Playwright on ports 3210 [orders open] and 3211 [orders closed]).
  `E2E_DATABASE_URL=postgres://…` runs against Postgres; `CHROME_PATH=/path/to/chromium` avoids the Playwright browser download.
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
git checkout main && git merge <branch> --no-edit && git push origin main
git checkout main && git pull        # next change starts here again
```

Then deploy (`npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`, token in `.env`),
smoke-test production, and delete any test rows created by the smoke test.

Git access: the remote uses the `github.com-innovin` SSH host alias (work account), so
push/merge work. The `gh` CLI is authenticated as the *personal* `AmitJaison` account, which
cannot resolve the private `amit-innovin/innovin-internal` — so `gh pr create` fails.

Per the owner's instruction, don't try to work around that: push the branch and merge to `main`
directly over SSH, keeping the one-branch-per-change discipline above. No PR object is created,
so never describe the work as "opened a PR" or "merged a PR" — say the branch was merged.
(If real PRs are wanted later, `gh auth login` as the work account is the one-time fix.)

## Conventions
- UI: shadcn/ui primitives in `components/ui`, beUI motion components in `components/motion`, shared blocks in `components/kit.tsx`, transitions.dev CSS in `app/transitions.css`. Brand tokens (innovinlabs.com) live in `app/globals.css`.
- Client network calls go through `lib/fetcher.ts` (`getJSON`, `send`, `readError`) — never raw `fetch` + `res.json().error`.
- API routes parse bodies with `readJSON` (400 on bad input) and apply limits via `enforce` (`lib/guard.ts`).
- Any Store change must be implemented in both `lib/jsonstore.ts` and `lib/pgstore.ts` and covered in `tests/store/contract.ts`.
- Leave rules live in `lib/leave.ts` (pure, unit-tested against the company policy and the 2026
  tracker's own working-day totals). Per-person 2026 entitlements and opening usage are imported
  data in `data/leave-2026.json`, matched to employees by Google display name — don't replace
  them with a single company-wide allowance, since staff and trainees carry different figures.
- OAuth links must be plain `<a href>`, never `next/link` — a Link prefetches the route and the
  redirect to Google trips the `connect-src 'self'` CSP.
- New dependencies: pin exact versions published ≥ 7 days ago.
