# Pantry provider integration

## Outcome and scope

Named office coordinators turn employee pantry requests into a reviewed, provider-priced grocery order. Existing requests remain internal demand, never provider-order confirmation. User requested Blinkit/Instamart integration, then confirmed no Blinkit partner access. Implement official Swiggy Instamart now; expose Blinkit as unavailable pending an approved ordering contract. Do not invent Blinkit endpoints.

Prior release PR #4 is merged. Work starts on fresh `pantry-provider-integration` from `origin/main` d9c9596. Preserve owner PRODUCT.md edits and PDF. No real purchase, provider-account mutation, push, merge or deployment is authorized merely by writing/testing this integration.

## Product decision

Use a shared office purchasing connection, accessible only to verified Google admins/owners, not anonymous PIN sessions. Coordinator chooses a saved delivery address explicitly, searches exact SKU variants and quantities against today's internal request summary, builds an office basket, explicitly replaces the provider cart for pricing, and confirms the final provider total/address/payment before placement. Employee choices are not auto-mapped to guessed SKUs.

First checkout slice supports Cash/COD only when returned as currently enabled by the provider. UPI and wallet charging are outside this bounded slice; show an honest unavailable-payment state when Cash/COD is absent. This follows the original pilot recommendation while current docs now also describe UPI. No real order is placed by the coding agent.

## Source evidence (refreshed October 26)

- https://mcp.swiggy.com/builders/docs/start/authenticate/ — OAuth PKCE, DCR, JSON code exchange and rotating refresh tokens.
- https://mcp.swiggy.com/builders/docs/start/developer/ — localhost development and production redirect/access application are distinct.
- https://mcp.swiggy.com/builders/docs/reference/instamart/search_products/ — address-based products and exact SKU variations.
- https://mcp.swiggy.com/builders/docs/reference/instamart/update_cart/ — full basket replacement, not incremental add.
- https://mcp.swiggy.com/builders/docs/reference/instamart/get_cart/ — canonical provider bill, stock, address and live payment availability.
- https://mcp.swiggy.com/builders/docs/reference/instamart/checkout/ — non-idempotent, explicit confirmation, multi-store partial results.
- https://mcp.swiggy.com/builders/docs/reference/instamart/get_orders/ — history/reconciliation; never blindly retry an unknown checkout.
- https://blinkit.com/terms — no approved consumer ordering contract available for this office integration.

## Owning implementation

- Native crypto for AES-256-GCM encryption at rest and OAuth state cookies; separate PANTRY_INTEGRATION_KEY (32-byte hex), no tokens in client/localStorage/logs. Explicit production callback URI; localhost-only inferred development callback.
- Official MCP SDK Streamable HTTP transport if an exact version at least seven days old can be verified. Fixed Swiggy host, request timeouts, no reconnect/replay of checkout. Server allowlist of tool operations; no arbitrary browser tool proxy.
- One encrypted provider state record with optimistic version/CAS in Store, implemented in JSON and PostgreSQL. Holds connection, selected office address, local basket, short-lived actor-bound quote, durable attempts/history and operation lease. CAS serializes across serverless instances and rotating token refreshes.
- OAuth start/callback with PKCE, anti-CSRF, expiry and initiating Google admin binding. Tokens encrypted server-side; connection changes invalidate quotes. Disconnect must not erase an unresolved purchase attempt.
- Admin purchasing page and GET/POST API for status, saved addresses, search, local draft, price/review, confirmed checkout, provider order history/status. Internal consolidated demand is visible alongside the catalog. Link from Admin Today.
- Cash/COD placement requires matching current quote ID, same named admin, exact unchanged freshly-read provider basket/address/total/stock and live payment availability. Persist submitting attempt before the external call. No automatic checkout retry; timeout/crash/partial/ambiguous result stays unresolved and blocks another purchase until reviewed/reconciled. Provider-confirmed IDs and per-store results remain distinct from local requests.
- No arbitrary address creation, provider cancellation, discount automation or automatic substitutions.

## Slices and verification

1. Red/green store CAS and encrypted-record isolation contract: absent creation, stale writer, competing lease, persistence across both stores.
2. Red/green encryption + fixed-host OAuth/transport boundary: tamper, wrong key, expired/wrong-user state, DCR/code exchange, rotated refresh persistence, private token redaction, unknown/malformed MCP response.
3. Red/green purchasing service with mocked provider boundary and real CAS behavior: exact variant selection, address ownership, basket replacement consent, short-lived quote, changed bill/stock, unavailable COD, concurrent/replayed checkout, timeout/unknown/partial success and restart durability.
4. API authorization tests: guest/member/PIN-only cannot purchase; named admin can; malformed bodies/rate limit; no internal provider tokens in responses.
5. Desktop/mobile UI E2E with a local fixture provider adapter boundary; never a production URL/token. Connect/error/disconnected, catalog, quantities, full price/address confirmation, saved provider ID/status, failed/unknown states. Preserve all real owning route/store behavior.
6. Typecheck, unit + JSON/Postgres contracts, webpack build, affected browser tests. Full required JSON/Postgres E2E before merging store changes. Separate source review before handoff. Live provider authorization remains pending until the user connects a purchasing account and Swiggy approves the production callback. Missing live access is not called a pass.

## Release boundary

No SWIGGY/INSTAMART/BLINKIT credentials currently exist in local environment files. Implement and verify against official documented contracts and provider fixtures. The shipped UI must say not connected until OAuth succeeds. Do not claim either provider is live from fixtures or configuration alone. Blinkit implementation cannot be completed without its approved partner contract; current user supplied none.

## Implementation and review outcome

Implemented OAuth/PKCE, fixed-host official SDK transport, encrypted CAS state in both
stores, exact variants, actor-bound two-minute reviews, COD checkout, durable uncertain
outcomes, positive history reconciliation and throttled delivery status. Coordinator UI
is linked from Admin Today. Blinkit remains unavailable, as confirmed by the owner.

Review blockers fixed and regression-tested: prevent receipt reuse across attempts;
use the live cart delivery text in the displayed quote and fingerprint; reject oversized
encrypted records before saving. Browser checks also caught/fixed iPhone delivery-button
overflow and Safari local HTTP PIN cookies (reusing the existing secure-cookie policy).
No new blockers remained in the final independent source review.

The setup guide documents encryption-key backup, production callback approval, ordering
kill switch, COD limitation and manual support when an unknown result cannot be matched.
No provider credentials, real account connection or live purchase was used in these checks.
