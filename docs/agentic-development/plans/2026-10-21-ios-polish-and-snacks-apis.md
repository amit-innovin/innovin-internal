# iOS mobile refinement and snack provider feasibility

## User outcome
Employees should be able to open the supplied wallet-style workspace on iPhone, read every card and use its controls comfortably in Safari or as an installed web app. Preserve the supplied palette, overlapping wallet cards and three-tab dock. Separately verify official Swiggy Instamart and Blinkit integration options; provider shopping/account mutations are out of scope.

## Evidence and approach
The current phone view draws a second Dynamic Island on a physical device, crowds the title with four small icons, uses sub-16px form controls, and inherits a fixed 520px expanded-card height with hidden overflow. The existing stylesheet layers also mean important vendor declarations need deliberate layer overrides. Reuse all owning APIs and domain rules.

## Implementation slices
1. Add opt-in WebKit iPhone coverage at small, standard and large widths. Prove the current defects with user-level checks: no simulated hardware on native mobile, visible card controls with 44px hit areas, 16px inputs, a reachable cart after expansion, safe viewport boundaries and a non-overlapping dock. Capture screenshots.
2. Refine the mobile header, wallet spacing, badges, expanded content, dialog/safe-area behavior, input sizing and keyboard-aware dock. Keep simulated hardware only in desktop phone preview. Preserve desktop layout and authenticated workflows.
3. Verify iOS sign-in round trip, pantry persistence, steps persistence, planner editing, notes and modal dismissal through existing mock-auth and local isolated storage. Check short, standard and large iPhones, plus existing desktop/mobile regressions.
4. Research official provider documentation and manifests. Record supported operations, OAuth/access requirements, payment/confirmation boundaries, cart overwrite/concurrency semantics and a recommended integration slice. Do not add fake provider availability or connect/place orders.

## Gates and completion
Run typecheck, production Webpack build, opt-in WebKit iOS tests and affected Chromium tests. Inspect screenshots and browser errors. State that WebKit emulation is distinct from physical-device verification. Preserve PRODUCT.md and the unrelated PDF. Keep changes local pending any further push instruction; the previous push was completed for the prior change.

## Verification and review
- Typecheck and Webpack production build passed after the final Safari face-visibility fix.
- The initial WebKit checks failed on the simulated hardware island, 12px pantry input and 12px profile input. Those scenarios now pass.
- Screenshot review then exposed WebKit painting a mirrored inactive back face. A focused regression failed before the fix; explicit inactive-face visibility and flip/unflip coverage now pass.
- Final Safari run: 15 tests passed across iPhone SE (3rd gen), iPhone 13 and iPhone 16 Pro Max emulation. Checks cover Google mock sign-in, touch sizes, viewport bounds, pantry persistence, profile editing, anonymous note publishing, step persistence, calendar editing, card flip and dismissal. Browser console errors fail the tests.
- Reviewed screenshots include wallet, pass calendar, expanded pantry, notice board, steps and planner. Temporary toast notices are dismissed through their close controls before capture.
- Physical iPhone hardware, the actual software keyboard and an installed home-screen session have not been tested. Safe-area/VisualViewport support is implemented; those physical behaviors remain a device check.
- Provider investigation is documented in `docs/research/2026-10-21-snacks-provider-apis.md`. Official Instamart MCP and public OAuth resource metadata were verified without connecting an account. No live provider cart/tool catalog was accessed and no shopping data was mutated.

Commands: `npm run typecheck`; `npm run build -- --webpack`; `E2E_IOS=1 npx playwright test ios.spec.ts --project=ios-small --project=ios --project=ios-large`.

- Final unchanged-feature regression: 40 tests passed across desktop and Chromium mobile for navigation, workspace, source-design integration, private notes, events, planner, steps and pantry. Command: `npx playwright test zip-design.spec.ts workspace.spec.ts navigation.spec.ts --project=desktop --project=mobile`.
- Preview was restarted on port 5001 with the existing isolated local JSON store. No credentials, unrelated PRODUCT.md changes, PDF, provider state or deployment were changed.
