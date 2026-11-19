# Speak up and Feed Report (Stage 6): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Speak up from the prototype, keeping it day-only and anonymous, and add a quiet Report flag to Feed posts.

**Spec:** `docs/superpowers/specs/2026-11-18-m3-speak-up-report-design.md`.

**Global Constraints:** The same as the Feed plan. Store changes must also pass `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/innovin_test npx vitest run tests/store/pg-store.test.ts`.

## Review Focus

1. A Speak up message stores no time, and no response carries a name, email or device. Tested in Task 2 (API).
2. Reporting a post twice, reporting your own post, or reporting a missing post returns 409, 400 or 404. Tested in Task 2.
3. `/api/admin/reported` never reveals who reported a post. Tested in Task 2.
4. Speak up works signed out. Tested in Task 3 (e2e).
5. A reply set by an admin shows only on the device that sent the message. Tested in Task 3.

### Task 1: Store

`GrievanceRow.topic` and `.reply`, `setGrievanceReply`, `addNoticeReport(noticeId, ref): boolean`, `countNoticeReports(): Record<string, number>`. Write the contract tests first (RED), then implement in both stores, then run JSON and pg. Commit.

### Task 2: Routes

- `POST /api/grievances`: takes `topic` (one of the five, optional) and stores a day-only `createdAt`.
- Admin `PATCH /api/grievances`: takes `reply`.
- `GET /api/grievances?scope=mine`: returns `topic` and `reply`.
- `POST /api/notices/report` and `GET /api/admin/reported`.
- The API tests cover Review Focus 1–3. Run them against the old build first (RED), then build and run again (GREEN). Commit.

### Task 3: Screens

- Rewrite `components/speak-up/speak-up-page.tsx` in Material 3.
- Add Report to the Feed's `PostCard` and the Earlier sheet.
- Rewrite the stale Speak up e2e tests in `e2e/grievances-wifi.spec.ts`.
- New tests:
  - signed out, send and see the reference;
  - a topic chip;
  - My reports shows "no reply yet", and the admin reply appears after an API PATCH;
  - Report a Feed post, then confirm, then see the toast.
- RED, then GREEN. Commit.

### Task 4: Gates and review

Run tsc, vitest (JSON and pg) and the full Playwright suite against the Stage 5 run. Then a fresh review and one fix pass.
