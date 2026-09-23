# Agent notes — innovin-internal

## Commands
- Dev: `npm run dev` (http://localhost:3000; admin PIN from `.env.local`, local default `1704`)
- Typecheck: `npm run typecheck` (check the exit code — `tsc` prints errors but a chained `&& echo` can hide them)
- Unit + store contract: `npm test`; add `TEST_DATABASE_URL=postgres://…` to include the Postgres contract
- E2E: `npm run test:e2e` (builds, then Playwright on ports 3210 [orders open] and 3211 [orders closed]).
  `E2E_DATABASE_URL=postgres://…` runs against Postgres; `CHROME_PATH=/path/to/chromium` avoids the Playwright browser download.
- Full gate: `npm run test:all`

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
cannot resolve the private `amit-innovin/innovin-internal` — so `gh pr create` fails. Until
`gh auth login` is run as the work account, "create the PR" means: push the branch, then open
`https://github.com/amit-innovin/innovin-internal/compare/main...<branch>` to raise it in the
browser. Never claim a PR exists or was merged unless a tool result actually says so.

## Conventions
- UI: shadcn/ui primitives in `components/ui`, beUI motion components in `components/motion`, shared blocks in `components/kit.tsx`, transitions.dev CSS in `app/transitions.css`. Brand tokens (innovinlabs.com) live in `app/globals.css`.
- Client network calls go through `lib/fetcher.ts` (`getJSON`, `send`, `readError`) — never raw `fetch` + `res.json().error`.
- API routes parse bodies with `readJSON` (400 on bad input) and apply limits via `enforce` (`lib/guard.ts`).
- Any Store change must be implemented in both `lib/jsonstore.ts` and `lib/pgstore.ts` and covered in `tests/store/contract.ts`.
- New dependencies: pin exact versions published ≥ 7 days ago.
