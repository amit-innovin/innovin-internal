# Release audit repairs

Scope: fix B1-B6 and A1-A7 from the October 26 audit without disturbing existing mobile/Zoho work. No publishing or live-provider writes are authorized by this plan.

Slices: session-bound push registration/revocation and generic private payloads; shared attendance presence; atomic leave decisions and unbounded actionable queue; explicit snapshot reconciliation; verified remote DB TLS; usable read failures and session recovery; remove dormant auto-check-in promise; notification refresh/timestamps; employee-scoped RSVP; modal accessibility/install icons; replacement E2E expectations.

Acceptance: account switches cannot deliver previous-user private payloads; both check-in paths agree on presence/eligibility; competing decisions cannot overwrite committed state; partial snapshots retain other leave history; remote TLS verifies certificates; failed loads offer retry/sign-in; current UI has no unsupported settings/promises; notification state only changes after successful writes.

Verification exception: the owner explicitly deferred verification earlier. Write regression coverage for integrity changes and run static typecheck/diff checks; do not execute unit, browser, device or live-provider tests until that deferral is lifted. No red/green or production-readiness claim may be made. Required full store/E2E/WebKit gates remain pending. This explicitly overrides the usual TDD execution sequence for this implementation pass.

Production CA installation will be prepared as a reviewable operation; no deployment or environment write is included in local repair scope.

## Resumed release work

The owner subsequently requested "push and continue remaining", lifting the verification deferral for the remaining local release gates and authorizing the branch push/PR workflow. The production CA was separately approved and applied; a trusted-TLS read-only SELECT 1 now succeeds. Deployment remains subject to the required merged-PR workflow. Preserve the owner's PRODUCT.md edits and untracked PDF.
