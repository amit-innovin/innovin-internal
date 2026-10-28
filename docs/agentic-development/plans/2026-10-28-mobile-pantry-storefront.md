# Consistent mobile routes and exact-product pantry

## User outcome and decision

The owner reports cluttered, different mobile interfaces after following Home's top buttons and wants an Instamart-style dedicated page instead of generic Tea/Snacks choices. Confirmed: employees choose products; the coordinator places the shared office order. Keep desktop/home design recognizable. Do not embed Swiggy, expose the supplier account to members, invent products/images, or place live purchases.

Source: WorkspaceNav currently wraps desktop navigation on non-wallet mobile routes. The provider API is coordinator-only and search products include real variant IDs, optional imageUrl, brand, MRP and offer price. Existing orders/fulfillment and encrypted provider records own persistence. Zoho and Blinkit are out of scope.

## Design

- A compact mobile toolbar and consistent page/card/field styling on all non-wallet routes; no wrapped desktop navigation. All tools remain available in More, and Home remains one tap away. Desktop remains unchanged.
- Dedicated `/pantry` shop: search/filter actual coordinator-published Instamart variants, names, images where returned, pack sizes, estimated prices, quantities, a basket and explicit submit/update/cancel. Separate existing office meal requests remain accessible; no Tea/Snacks tiles as the main shopping surface.
- Coordinators publish products from fresh provider search into an office catalog with a category; changing account/address clears this catalog. Catalog is a snapshot, never a live-price promise, and expires after 24 hours until republished. Product images use only explicitly allowed Swiggy CDN HTTPS hosts.
- Employees receive only published catalog metadata, own request and allowed-action state. Never addresses, provider tokens, other employees' baskets or supplier receipts.
- Reuse OrderRow and preparation locks, adding an optional exact-product/quantity snapshot column and atomic expected-row-ID check. Client submits IDs/quantities, never trusted prices/names. Existing office/pantry cutoff, employee identity and four distinct-item limit apply. Replacing an existing generic request is explicit and revision checked. Legacy endpoint must not silently overwrite product requests.
- Prepared exact-product requests can populate the coordinator basket, aggregating quantities and rejecting changed catalog context or quantity caps. Explicit review/checkout and unknown-outcome safeguards remain unchanged. Fulfillment stays separate from supplier purchase.

## Slices and evidence

1. Mobile: browser regression follows top-button destinations and checks single-row toolbar, accessible tools, 44px targets and no overflow on SE/Pixel widths. Red on existing build, then responsive toolbar/page styles and screenshots.
2. Store: shared contract for exact-product roundtrip, quantity snapshot, stale expected IDs and preparation lock. JSON + Postgres parity, additive JSONB column.
3. Catalog: unit regression for publish from provider search, safe employee projection, address/account reset, expiration, tampered selection and aggregate prepared basket. Implement in owning provider service with version/operation lock. New signed-in employee endpoint uses existing guards/fetcher.
4. Shop: browser flow coordinator connects/publishes real fixture product -> employee searches/adds/changes quantity/submits/reloads -> coordinator starts preparation/imports -> employee sees status/locked changes. Auth/privacy, stale cart, empty/unavailable state, no unintended provider checkout, cancellation and mobile viewport evidence.
5. Navigation: Home pantry focuses on opening shop and request status; legacy meal page remains secondary. Update all order-name/quantity consumers and notifications for exact products.
6. Typecheck, unit + both stores, webpack build, affected browser/iPhone slices, independent review, then one full JSON/PG browser matrix before PR readiness because store changed. Never rerun unchanged passed suites without cause.

## Release constraints

Fresh branch `mobile-pantry-storefront` from merged main (PR #6). Preserve owner PRODUCT.md edits and PDF; recoverable patch in temporary storage. Follow required PR workflow; no direct main push or local merge. Runtime/provider activation and physical-device performance remain separate evidence from fixtures.

## Implemented journey and review

Home and the toolbar open `/pantry`. Employees search/filter published products, select exact packs and quantities, review their estimate and instructions, explicitly send/update/cancel, and follow coordinator fulfillment. Device drafts survive reload only while the request is editable. Preparing/closed requests show the accepted snapshots, even when an unsent local basket differs. Meals/drinks remain secondary and cannot overwrite/cancel a product request through the old endpoint.

Coordinators search the connected Instamart account, publish variants by category, review incoming requests, mark the exact requests Being prepared, and explicitly aggregate them into the supplier draft. Existing live bill review, explicit checkout and uncertain-outcome recovery remain separate. No provider activation or live purchase was performed.

Independent read-only review found a locked request could restore an unsent local draft. Fixed the editability gate, preserved accepted snapshots and added a sequence covering submitted quantity 2, unsent quantity 3, reload, preparation, then accepted quantity 2. Follow-up review found no remaining blockers. Earlier review fixes protect exact-product requests from legacy writes/deletes and remove an invalid generic repeat-history action.

## Verification evidence

- `npm run build -- --webpack`: passed after the final source change; TypeScript compilation passed.
- `npm run typecheck`: passed after the final source change.
- `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/innovin_readiness_test npm test`: 232 passed, including both shared store contracts.
- Full JSON browser matrix before the final draft fix: 229 passed, two desktop skips of mobile-only checks, one product-flow failure caused by a prepared fixture left behind across account resets; API dependencies did not run. Product fixture now completes its fulfillment lifecycle.
- `npx playwright test pantry-shop.spec.ts navigation.spec.ts api.spec.ts --no-deps`: 53 passed on the final build, completing the JSON product, navigation/help and API checks.
- Full Postgres browser matrix: 261 passed, two desktop skips of mobile-only checks. Ran before the final UI-only draft restoration fix; store/server code unchanged afterward.
- `E2E_IOS=1 npx playwright test --project=ios-small --project=ios --project=ios-large --project=ios-pantry --no-deps`: 24 passed on the final build, including product requests, unknown purchase recovery, compact toolbar destinations and SE/standard/large viewport journeys.
- Inspected desktop and mobile product/basket screenshots, mobile route toolbar and iPhone SE empty shop. Product images absent from the fixture correctly show neutral package placeholders.
- Final Postgres `npx playwright test pantry-shop.spec.ts --no-deps`: four passed on the final build, including unsent-draft restoration and preparation locking on desktop/mobile.
- `git diff --check`: passed.

The browser checks use local Google/provider fixtures, not a supplier sandbox. Production catalog availability, callback approval, real stock/final fees, delivery and physical-device frame rate remain unproven. The coordinator must connect an approved account and publish real products; an unconfigured deployment shows an empty shop. Blinkit remains unavailable pending approved partner access.
