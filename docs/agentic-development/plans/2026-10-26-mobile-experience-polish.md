# Mobile workspace polish

Owner request: implement the recommended mobile polish now; defer browser/device
verification. Use the merged readiness implementation as the base. Preserve the
owner's PRODUCT.md edits and PDF. No push or deployment is authorized for this change.

## User outcome

Employees can find daily tools and compose a private note without overlapping
floating controls. Expanded cards stay in the page flow. Typing in Android Chrome
and iOS Safari leaves space for inputs and dialogs, while background refresh and
decorative motion do less work during interaction.

## Implementation slices

1. Share a controlled paper-note composer between the desktop launcher and a
   labeled fourth mobile dock action. Remove the separate mobile floating launcher.
2. Replace overlapping wallet cards with spaced summary cards; retain the identity
   pass and its explicit WebKit face visibility. Preserve existing accessible action
   names, add expansion relationships, and return focus on collapse.
3. Centralize visual-viewport tracking for the workspace and portal dialogs, detect
   keyboards even when Android also resizes the layout viewport, and reserve dock
   and safe-area space. Keep motion to short opacity/transform feedback with reduced
   motion support and avoid broad height/shadow transitions on scrolling surfaces.
4. Pause periodic workspace refresh while hidden, editing, or using a dialog. Resume
   on visibility/focus when safe. Do not change server authorization or data contracts.

## Additional owner decisions during implementation

- Remove desktop Phone View preview rather than maintain a second device view.
- Move People in Office into the central team area with a compact Notice Board.
- Paper notes may target one teammate or the whole team. Reuse private expiring
  pings for one recipient and authenticated, named board posts for team notes.
  Explain visibility and retention before sending; team notes do not silently
  become private messages or promise push delivery.
- Pantry provider code remains unconnected: Instamart/Blinkit work is research only.
- Owner subsequently approved read-only Zoho integration. See the separate plan
  2026-10-26-zoho-read-only.md. No provider leave writes or fabricated synced data
  are part of this change; live OAuth setup and verification remain outstanding.

## Acceptance and checks

- One mobile fixed navigation surface with visible Home, Steps, Board and Note labels.
- Note composer uses the same API, draft state, length limits, busy state and errors.
- Dock controls have at least 44px touch targets and do not sit over final page content.
- Small-screen cards have natural heights and stable spacing; keyboard use hides the
  dock and dialogs fit the visual viewport. Desktop preview follows the same layout.
- No new dependencies. Typecheck and diff review now; explicit owner instruction
  defers browser, device, performance and E2E checks. No TDD/browser run is required
  for this UI pass under that instruction. Do not claim smoothness is verified.
- Later checks: existing iOS, navigation, workspace, paper-note, pantry and planner
  flows; Android keyboard resize and foreground/background behavior; frame profiling
  on physical iPhone and Android hardware. New dock behavior needs coverage then.

## Implementation handoff

Implemented in components/workspace/{nav,portal,phone,notes}.tsx,
lib/hooks/use-mobile-viewport.ts, app/workspace-polish.css, and app/layout.tsx.
Typecheck and git diff --check passed. Browser/device tests deliberately deferred
by the owner; existing tests referencing Phone View need updating when verification
resumes, and whole-team notes need new persistence/visibility browser coverage.
