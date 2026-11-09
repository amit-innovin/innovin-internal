# Admin / Member Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace owner > admin > member + the shared admin passcode with exactly two roles, `admin` and `member`. Signed-out visitors and members never see pages they can't use.

**Architecture:**
- The access model follows `../report-app`:
  - A `proxy.ts` sends signed-out visitors to `/sign-in`.
  - Route groups `(member)` and `(admin)` have layouts that call the `requireUser()` / `requireAdmin()` guards and redirect, instead of rendering a login form.
  - Every API route still checks the role itself.
- Roles live in `employees.role`. Admins are bootstrapped by `ADMIN_EMAILS`, and any admin can promote or demote other members.
- Google sign-in is the only way in.

**Tech Stack:** Next.js 16 App Router (`proxy.ts`), TypeScript, Postgres (`lib/pgstore.ts`) and JSON (`lib/jsonstore.ts`) stores, Vitest, Playwright.

**Spec:** Decisions recorded on 2026-11-09 (conversation with the owner):
- Two roles only: admin and member. All pantry, grievance, leave, announcement and people duties belong to admin.
- Bootstrap admins come from an env list and can't be demoted in-app. Any admin can promote or demote other members.
- The shared `ADMIN_PASSCODE` is removed entirely.
- A member who opens `/admin` must not see an admin page or a passcode prompt; they are redirected.
- Fix the small bugs found in the audit:
  - the ID pass always says MEMBER
  - `ALLOWED_EMAIL_DOMAINS` is ignored
  - the admin pantry link dead-ends for passcode sessions
  - signed-out visitors see inconsistent pages

## Global Constraints

- Work on branch `admin-member-roles`, cut fresh from `main`. It ships as a PR. Never merge to `main` locally (`AGENTS.md`).
- Every `Store` change goes in both `lib/jsonstore.ts` and `lib/pgstore.ts`, and is covered in `tests/store/contract.ts`.
- Client network calls go through `lib/fetcher.ts`. API bodies are parsed with `readJSON`, and rate limits are applied via `enforce`.
- OAuth links are plain `<a href>`, never `next/link`.
- Anonymous Speak Up (`/grievances` and `POST /api/grievances`) stays usable without signing in.
- `SESSION_SECRET` is the only session signing key; it no longer falls back to `ADMIN_PASSCODE`.
- `ADMIN_EMAILS` (comma-separated, lowercased) replaces `OWNER_EMAILS`. Read `OWNER_EMAILS` as a fallback, so production keeps its bootstrap admins until the env var is renamed.
- No new dependencies.

## Review Focus

1. **Existing `owner` rows in production Postgres** must become `admin` on first use, not `member`, and not an unknown role that fails checks. → Task 1 contract test.
2. **A deployment without `SESSION_SECRET`:** sign-in must fail visibly (`/sign-in?auth=unavailable`), not loop silently. → Task 2 test.
3. **A stale or forged `innovin_user` cookie:** the proxy lets it through because a cookie is present, so the layout guard must still redirect to `/sign-in` and not render an empty page. → Task 4 test.
4. **An admin demoted mid-session** must lose `/admin` and admin APIs on the next request. The role is read from the DB on each request, never from the cookie. → Task 3 test.
5. **A member calling admin APIs directly** gets JSON 401/403, never an HTML redirect or data. → Task 3 test.

---

### Task 1: Two-role model, env bootstrap list, store migration

**Files:**
- Modify: `lib/types.ts:6` (Role), `lib/config.ts:9-16` (ownerEmails → adminEmails), `lib/pgstore.ts` (schema block near line 197), `lib/jsonstore.ts` (employee read path + `setRole`)
- Test: `tests/store/contract.ts`, `tests/unit/server-libs.test.ts`

**Interfaces:**
- Produces:
  - `type Role = "admin" | "member"`
  - `adminEmails(): string[]` in `lib/config.ts`: lowercased and trimmed; from `ADMIN_EMAILS`, or from `OWNER_EMAILS` when `ADMIN_EMAILS` is empty
  - Stores never return a role other than `"admin"` or `"member"`

- [ ] **Step 1: Write failing tests**
  - In `tests/store/contract.ts`, add `it("legacy owner rows read back as admin")`:
    - seed an employee with `role: "owner" as never` via `upsertEmployee`
    - expect `(await store.getEmployee(email))!.role` toBe `"admin"`, and the same row in `listEmployees()` toBe `"admin"`
  - In `tests/unit/server-libs.test.ts`, add `describe("adminEmails")`:
    - `ADMIN_EMAILS=" A@innovinlabs.com, b@innovinlabs.com ,"` → `["a@innovinlabs.com","b@innovinlabs.com"]`
    - empty `ADMIN_EMAILS` with `OWNER_EMAILS="o@innovinlabs.com"` → `["o@innovinlabs.com"]`
    - both empty → `[]`
- [ ] **Step 2: Run and confirm they fail.** Run: `npx vitest run tests/store tests/unit/server-libs.test.ts`. Expected: FAIL (`adminEmails` not exported; role is `"owner"`).
- [ ] **Step 3: Implement**
  - Narrow `Role`.
  - Rename `ownerEmails` → `adminEmails`, with the fallback.
  - pgstore: in the schema block, after the `ADD COLUMN ... role`, add `UPDATE employees SET role = 'admin' WHERE role = 'owner';`. It is idempotent and runs with the existing schema init.
  - jsonstore: map `"owner"` → `"admin"` wherever employee rows are read, so old local `data/store.json` files behave the same.
  - Fix compile errors from the narrowed type: replace every `=== "owner"` / `["admin","owner"]` check with `=== "admin"`. Sites: `app/api/grievances/route.ts:60`, `app/api/away/route.ts:147,161`, `app/api/snacks/route.ts:112`, `lib/pantry/access.ts:6`, `lib/notifications.ts:64`, `app/admin/pantry/page.tsx:11`, `app/people/page.tsx:16`.
- [ ] **Step 4: Run and confirm they pass.** Run: `npx vitest run tests/store tests/unit/server-libs.test.ts && npm run typecheck`. Expected: PASS, typecheck exit 0. Add `TEST_DATABASE_URL=…` to cover the pg contract (see `AGENTS.md` for the local Postgres setup).
- [ ] **Step 5: Commit:** `feat(roles): admin and member only; ADMIN_EMAILS bootstraps admins; legacy owners read as admin`

### Task 2: Remove the shared passcode; identity-only admin; fix sign-in edges

**Files:**
- Modify: `lib/admin.ts` (rewrite), `lib/auth.ts:4-11`, `lib/google.ts:55`, `app/api/auth/callback/route.ts:41-60`, `lib/config.ts` (drop `ADMIN_SESSION_MS`, `LIMITS.adminLoginIp`, `LIMITS.adminLoginGlobal`)
- Delete: `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`, `components/admin-login.tsx`
- Test: `tests/unit/server-libs.test.ts` (remove the passcode `describe` blocks at ~129-161 and the `ADMIN_PASSCODE` stubs), new `tests/unit/admin-access.test.ts`

**Interfaces:**
- Consumes: `adminEmails()`, `Role` (Task 1)
- Produces, in `lib/admin.ts`:
  - `type Actor = { email: string; name: string; role: Role }`
  - `currentActor(): Promise<Actor | null>`: wrapped in React `cache()`; verified session plus the role read from the store on every request
  - `isAdmin(): Promise<boolean>`: `(await currentActor())?.role === "admin"`
  - `requireUser(): Promise<Actor>`: redirects to `/sign-in?next=<x-pathname header, sanitized>` when there is no actor
  - `requireAdmin(): Promise<Actor>`: calls `requireUser()`, then redirects to `/` when the role isn't admin
- `isOwner`, `hasPin`, `ADMIN_COOKIE`, `validAdminPasscode`, `createAdminSession` and `verifyAdminSession` no longer exist.

- [ ] **Step 1: Write failing tests** in `tests/unit/admin-access.test.ts`. Mock `next/headers` (`cookies`, `headers`), `next/navigation` (`redirect` throws `Error("REDIRECT:" + url)`) and `@/lib/store`.
  - `requireAdmin` with a valid member session throws `REDIRECT:/`.
  - `requireAdmin` with no cookie throws `REDIRECT:/sign-in?next=%2Fadmin` when `x-pathname` is `/admin`.
  - `requireUser` with a forged cookie `innovin_user=forged.sig` throws a `REDIRECT:/sign-in…` (Review Focus 3).
  - `isAdmin()` reflects a role change between two calls in separate requests: the store returns admin and then member (Review Focus 4).
  - An `innovin_admin` cookie of any value grants nothing: `isAdmin()` is false with no user session.
  - `x-pathname` of `//evil.com` → `next=%2F`.
  - In `server-libs.test.ts`: with `SESSION_SECRET` empty and `ADMIN_PASSCODE="1704"`, `createUserSession(me)` is `null`.
  - Callback: with `SESSION_SECRET` empty, `GET /api/auth/callback` (state and Google mocked as in `tests/unit/oauth-cookie.test.ts`) redirects to `/sign-in?auth=unavailable` (Review Focus 2).
  - `verifyIdToken`, with `ALLOWED_EMAIL_DOMAINS="innovinlabs.com,innovin.dev"`, accepts `x@innovin.dev` and still rejects `x@gmail.com`.
- [ ] **Step 2: Run and confirm they fail.** Run: `npx vitest run tests/unit`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - Rewrite `lib/admin.ts` to the interface above.
  - `lib/auth.ts`: `secret = () => process.env.SESSION_SECRET`.
  - `lib/google.ts:55`: drop the hardcoded `domain !== "innovinlabs.com"` and keep `allowedEmailDomains().includes(domain)`. The default is still `innovinlabs.com`.
  - Callback:
    - `role: adminEmails().includes(email) ? "admin" : "member"` on insert, and `setRole(email, "admin")` for listed emails on every sign-in
    - if `createUserSession` returns null, `fail(req, "unavailable")`
    - change `fail()` to redirect to `/sign-in` (Task 4 creates the page; `/settings` is gated after Task 4)
  - Delete the passcode routes and component.
  - Remove `ADMIN_PASSCODE` from `next.config.ts` if referenced.
  - Fix remaining compile errors in callers (`app/admin/page.tsx`, `app/api/people/route.ts`); Task 3 and Task 4 finish those files.
- [ ] **Step 4: Run and confirm they pass.** Run: `npx vitest run tests/unit && npm run typecheck`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit:** `feat(auth): admin access by Google identity only; remove shared passcode; respect ALLOWED_EMAIL_DOMAINS`

### Task 3: API routes on the two-role model

**Files:**
- Modify: `app/api/people/route.ts:43-80`, plus every route that called `isOwner` or checked `"owner"` (see Task 1, Step 3)
- Test: `tests/unit/admin-access.test.ts` (extend), `tests/unit/employee-access.test.ts`

**Interfaces:**
- Consumes: `currentActor`, `isAdmin` (Task 2), `adminEmails` (Task 1)
- Produces the `PATCH /api/people {email, role}` contract:
  - any admin may set `"admin"` or `"member"`
  - 403 `"Set in ADMIN_EMAILS — change it there"` when the target is in `adminEmails()`
  - 403 `"You can't change your own role"` when the target is the caller
  - 400 for any other role value
  - 401 for non-admins

- [ ] **Step 1: Write failing tests**
  - An admin promotes a member → 200 and `store.setRole` called with `(email,"admin")`.
  - An admin demotes another non-env admin → 200.
  - Demoting an `ADMIN_EMAILS` admin → 403.
  - Self-demotion → 403.
  - `role:"owner"` → 400.
  - A member session → 401.
  - Member session vs every admin-only handler gets status 401 or 403 with a JSON body, and the `content-type` contains `application/json` (Review Focus 5). Handlers: `GET /api/grievances`, `PATCH /api/grievances`, `GET /api/snacks`, `PATCH /api/snacks`, `GET /api/away` (no `scope=mine`), `PATCH /api/leave`, `POST /api/announcements`, `GET /api/pantry-provider`.
- [ ] **Step 2: Run and confirm they fail.** Run: `npx vitest run tests/unit/admin-access.test.ts`. Expected: FAIL on the people PATCH cases.
- [ ] **Step 3: Implement** the PATCH contract and update the comment at `:43`. `lib/pantry/access.ts` `purchasingActor()` becomes `requireAdmin`-equivalent logic: it returns the actor when `role === "admin"`.
- [ ] **Step 4: Run and confirm they pass.** Run: `npx vitest run && npm run typecheck`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit:** `feat(roles): any admin manages roles except env-listed admins and themselves`

### Task 4: Page access — proxy, sign-in page, route groups, role-aware UI

**Files:**
- Create:
  - `proxy.ts`
  - `app/sign-in/page.tsx`: renders the existing `WorkspaceOnboarding` with `googleEnabled` and `next`, plus the `?auth=` error copy moved from `app/settings/page.tsx:17-21`
  - `app/(member)/layout.tsx`: `await requireUser()`
  - `app/(admin)/layout.tsx`: `await requireAdmin()`
- Move with `git mv` (URLs unchanged):
  - into `app/(member)/`: `page.tsx`, `attendance/`, `planner/`, `snacks/`, `pantry/`, `wifi/`, `steps/`, `events/`, `people/`, `settings/`, `help/`
  - `admin/` → `app/(admin)/admin/`
  - `grievances/` stays at the root (public)
- Delete: `components/employee-gate.tsx`, `app/attendance/layout.tsx`, `app/people/layout.tsx`
- Modify:
  - `components/workspace/page.tsx`: drop its signed-out branch; the layout guarantees a user
  - `app/(admin)/admin/page.tsx`: drop the `isAdmin` and login branch and `pinSession`; the header uses `actor.name`; the Access card shows for every admin
  - `components/access-list.tsx`: env-listed admins show "Set in ADMIN_EMAILS" instead of a button, and the caller's own row has no button. Pass `locked: string[]` from the page.
  - `components/workspace/nav.tsx`: when `!signedIn`, render only the brand and a plain `<a href="/api/auth/google?next=…">Sign in</a>`
  - `app/(member)/settings/page.tsx:101-110`: show the Admin card only when `/api/auth/me` returns `role: "admin"`, and add `role` to that route's response
  - `components/workspace/pass.tsx:105`: render `role === "admin" ? "ADMIN" : "MEMBER"` from `WorkspaceData.user.role`, adding `role` in `lib/workspace.ts:24` via `currentActor()`
  - `app/(member)/people/page.tsx:161-163`: the badge shows only for `"admin"`

**Interfaces:**
- Consumes: `requireUser`, `requireAdmin`, `currentActor` (Task 2)
- Produces, in `proxy.ts`:
  - `isPublicPath(pathname: string): boolean`: true for `/sign-in`, `/grievances`, and any path under `/api/`, `/_next/`, `/brand/`, `/icons/` or `/assets/`, plus `/sw.js`, `/manifest.webmanifest`, `/icon.svg` and `/favicon.ico`
  - `proxy(request: NextRequest)`:
    - public path → `next()`
    - no `innovin_user` cookie → 307 to `/sign-in?next=<path+search>`
    - otherwise `next()` with the request header `x-pathname` set to path+search
  - `config.matcher` excludes `_next/static`, `_next/image` and `api/`

- [ ] **Step 1: Write failing tests**
  - `tests/unit/proxy.test.ts`, using `new NextRequest(...)`:
    - `/admin` with no cookie → 307 with `location` `/sign-in?next=%2Fadmin`
    - `/attendance?tab=leave` with no cookie → `next=%2Fattendance%3Ftab%3Dleave`
    - `/grievances`, `/sign-in`, `/api/attendance` and `/sw.js` with no cookie → not redirected
    - `/admin` with `innovin_user=x.y` → passes with `x-pathname: /admin`
  - New `e2e/access.spec.ts`:
    - a signed-out visit to `/`, `/admin` and `/pantry` lands on `/sign-in`, with a "Continue with Google" link visible and no console errors
    - a signed-out visit to `/grievances` shows the "Speak Up" heading and the nav has no "Admin"/"More" links
    - a member visiting `/admin` and `/admin/pantry` lands on `/`, and the page has no "passcode" text
    - a member's ID pass shows MEMBER, and the env admin's shows ADMIN
    - a member's settings page has no Admin dashboard card
- [ ] **Step 2: Run and confirm they fail.** Run: `npx vitest run tests/unit/proxy.test.ts` (FAIL: module missing), then `npm run build && npx playwright test access.spec.ts --project=desktop` (FAIL).
- [ ] **Step 3: Implement** everything listed under Files.
- [ ] **Step 4: Run and confirm they pass.** Run the same commands. Expected: PASS. Also run `npm run typecheck`, exit 0.
- [ ] **Step 5: Commit:** `feat(access): proxy and route-group guards; members never see admin pages; signed-out visitors go to sign-in`

### Task 5: E2E suite, docs, full gate

**Files:**
- Modify:
  - `playwright.config.ts:14,25`: remove `ADMIN_PASSCODE` and set `ADMIN_EMAILS: "admin@innovinlabs.com"`
  - `e2e/fixtures.ts`: `adminLogin(page, tab)` keeps its signature but signs in through the Google mock as `admin@innovinlabs.com` (the same pinned-identity flow as `signInEmployee`) and then opens `/admin?tab=…`; delete `typePin`
  - `e2e/roles.spec.ts`: rewrite for the admin/member and env-admin rules from Task 3
  - `e2e/api.spec.ts`: delete the passcode-only tests ("session cookie is HttpOnly, SameSite=Lax, 12h…", "HTML form login works without JavaScript", "admin PIN brute force…", "a successful login clears earlier failures…"); switch admin request contexts to the Google-mock admin
  - specs that relied on signed-out pages: `attendance`, `pings`, `steps`, `snacks`, `grievances-wifi`, `events`, `navigation`; any guest flow now signs in first, except Speak Up
  - Docs: `README.md` (Modules → Roles, the Configuration table, Security notes), `.env.example` (remove `ADMIN_PASSCODE`, rename `OWNER_EMAILS` → `ADMIN_EMAILS`, set `SESSION_SECRET=local-dev-secret` with a "required" comment), `app/(member)/help/page.tsx` copy, `AGENTS.md` (the "admin PIN" line under Commands), `PRODUCT.md` role section

- [ ] **Step 1: Update the specs and fixtures** listed above.
- [ ] **Step 2: Run the full gate.** Run: `npm run typecheck && npm test && npx playwright test`, then the same suite with `E2E_DATABASE_URL=postgres://…` and `TEST_DATABASE_URL=postgres://…`; this change touches the store. Expected: everything passes on both backends.
- [ ] **Step 3: Confirm nothing references the removed pieces.** Run: `grep -rnE "ADMIN_PASSCODE|OWNER_EMAILS|isOwner|typePin|innovin_admin|\"owner\"" app lib components e2e tests README.md .env.example PRODUCT.md`. Expected: only the `OWNER_EMAILS` fallback in `lib/config.ts`, its test, and the legacy-owner migration and contract test.
- [ ] **Step 4: Commit:** `test(e2e): admin by Google identity; docs for admin/member roles`

### Task 6: Ship

- [ ] **Step 1: Check production env names** (names only, read-only): `npx vercel env ls production --token "$VERCEL_TOKEN"`.
  - `SESSION_SECRET` must exist. **If it doesn't, stop and tell the owner:** production signs sessions with `ADMIN_PASSCODE` today. Setting `SESSION_SECRET` to the current `ADMIN_PASSCODE` value keeps everyone signed in, and any new value signs everyone out once.
  - Ask the owner to add `ADMIN_EMAILS`. `OWNER_EMAILS` keeps working as the fallback meanwhile.
- [ ] **Step 2: Push the branch and open the PR.** `gh` can't reach the repo (`AGENTS.md`), so hand the owner `github.com/amit-innovin/innovin-internal/pull/new/admin-member-roles`. Do not merge or deploy without the owner.
