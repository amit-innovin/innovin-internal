# Instamart office purchasing

The coordinator workflow lives at `/admin/pantry`, linked from Admin > Today > Pantry requests.
An admin or owner must sign in with Google. The shared admin PIN cannot connect a supplier,
read provider account information, or place a purchase. Employee snack requests remain internal
requests; they never automatically become supplier orders or marked fulfilled purchases.

## Setup

1. Set `PANTRY_INTEGRATION_KEY` to a stable 32-byte hex secret (`openssl rand -hex 32`).
   Store a secure backup. The same key must be present on every app instance; key rotation
   requires a migration of the encrypted records. Do not change it to recover a connection.
2. Set `PANTRY_SWIGGY_REDIRECT_URI` to the exact canonical app URL ending in
   `/api/pantry-provider/callback`. Production requires HTTPS and Swiggy approval/allowlisting.
   Localhost development can use the same callback path without a configured URL.
3. Leave `PANTRY_ORDERING_ENABLED=false` initially. Open `/admin/pantry` and connect the Swiggy
   account used for office purchases. Authentication and OTP stay on Swiggy's own pages.
4. Explicitly select its saved office address. Search exact products/pack sizes, choose quantities,
   acknowledge replacing the entire Swiggy cart, then review the live returned bill and stock.
5. Confirm provider production access, permissions for the intended office use, account ownership,
   serviceability, bill and available Cash/COD with Swiggy before enabling production ordering.
   Set `PANTRY_ORDERING_ENABLED=true` only when ready for authorized purchases. The user must
   explicitly confirm each exact order. UPI and wallet payment are outside this first release.

Swiggy uses dynamic public-client registration and PKCE; no manually configured client secret
is needed. Tokens rotate and are saved before subsequent requests. Both JSON and Postgres
stores persist encrypted provider records with versioned conditional writes. Production uses
Postgres. Keep the database backups and integration key together in the recovery plan.

## Publish the employee shop

Employees open `/pantry` from Home or the pantry icon. This is the app's own office shopping page using returned Instamart product metadata, not an embedded Swiggy session. No sample products are shown in production.

1. Connect the office account and select its delivery address as above.
2. Search a product, verify the exact pack/variant and choose its office category. Select **Share with team**. Repeating search and **Refresh team listing** updates its price, stock and publication time. Optional images are accepted only from approved HTTPS Swiggy CDN hosts; other/missing images use a neutral package placeholder.
3. Employees browse only the published variants, with no supplier addresses, credentials, cart or receipt data. They choose up to four distinct products and quantities allowed by the provider. A local draft is tied to their Google account, current day, catalog revision and unchanged request IDs. **Send request** makes it visible to the coordinator; browsing or drafting does not purchase anything.
4. Review each exact request and mark it **Being prepared** before using **Use prepared team requests**. This explicitly replaces the coordinator's draft with aggregated prepared quantities. Changed office context, expired listings and quantities exceeding the provider cap are rejected. Refresh/reconcile the requests instead of silently reducing them.
5. Continue with the existing provider-cart replacement, live bill and explicit checkout confirmation. Employee fulfillment remains a separate coordinator action.

Published listings expire after 24 hours until refreshed from a new provider search. Changing the connected account or selected delivery address clears the published shop. Product prices are estimates; provider fees, final quantities, stock and payment are confirmed at review. A missing setup produces an honest empty shop; a temporarily unavailable catalog still permits reading/cancelling saved requests. Office check-in and the existing cutoff apply when sending requests. A saved meal request can be explicitly replaced with products; stale legacy meal saves/cancellations cannot overwrite a product basket.

## Employee request fulfillment

The existing daily-demand rows in Admin and Purchasing show a coordinator status control.
Mark the exact reviewed tray Being prepared before purchasing. Employee changes and cancellation
are then locked atomically. If preparation has not led to a purchase, explicitly reopen the
request to permit a correction. Reopening or cancelling a request does not cancel a supplier order.
Mark Ready for collection and Collected / delivered only after observing those outcomes.
Employees see the status on Home, Meals & Snacks and in their notifications. Supplier receipts
and delivery tracking remain separate; no provider receipt automatically marks employee delivery.

## Purchasing and recovery

A single shared purchasing connection/cart is serialized across coordinators and app instances.
A review is bound to the named admin and expires in two minutes. Checkout re-reads the live cart
and payment methods and refuses a changed bill. The app records an attempt before calling
non-idempotent checkout, never automatically retries it, and preserves unknown/partial outcomes.

If checkout times out or the server restarts, do not order the basket again. Refresh purchasing,
check recent provider orders and the Swiggy account. The UI can reconcile an unknown attempt
only with explicitly selected live receipts matching address, submission time, names, quantities
and total. Existing receipts cannot resolve a second attempt. The limited history cannot prove
absence of a purchase. If it cannot be matched, contact Swiggy support; ordering remains blocked.
For partial multi-store results, review every returned store outcome, then explicitly acknowledge
it before building a new basket. Do not resubmit the original basket. Cancellation/refunds remain
in Swiggy. Delivery refresh respects the provider's interval and stops at terminal outcomes.

New purchasing is disabled by setting `PANTRY_ORDERING_ENABLED=false`; this preserves receipts
and allows read/reconciliation. Do not remove the encryption key or database rows to clear a lock.
A lock expires after 90 seconds, but a submitting checkout becomes unknown, never retryable.

## Verification boundaries

Unit tests exercise encryption, state/PKCE, variant validation, concurrent checkout, changed bills,
partial outcomes and lost responses/reconciliation. Store contracts cover conditional writes in
both backends. `e2e/pantry.spec.ts` exercises a real browser through app OAuth, official SDK/MCP
transport, address selection, search, cart, review, checkout receipt and delivery against a local
fixture (`e2e/pantry-mock.ts`). The fixture is started only by test setup, at port 3998. Its URL
override accepts loopback HTTP only and is rejected on Vercel. It is not a provider sandbox.

Passing fixtures does not establish live Swiggy account access, production callback approval,
provider stock/pricing/fees, COD availability or delivery. Those require a connected approved
account and an explicitly authorized live pilot. No live purchase is required to run local checks.

Blinkit is unavailable because approved partner ordering access has not been obtained. No public
ordering contract or unofficial scraping/cookie flow is implemented. Add a Blinkit adapter only
when its approved ordering documentation and credentials are available.

## Official contracts

- [Swiggy developer access](https://mcp.swiggy.com/builders/docs/start/developer/)
- [OAuth and PKCE](https://mcp.swiggy.com/builders/docs/start/authenticate/)
- [Instamart tools](https://mcp.swiggy.com/builders/docs/reference/instamart/)
- [Live payment options](https://mcp.swiggy.com/builders/docs/reference/instamart/get_payment_options/)
- [Checkout](https://mcp.swiggy.com/builders/docs/reference/instamart/checkout/)
