# Snacks provider feasibility

Verified 2026-10-21. Research only: no provider account was connected, no cart changed and no order placed.

## Recommendation
Use Swiggy Instamart for a provider pilot. Keep employee requests in Innovin and let an administrator review one consolidated basket before checkout. Keep Blinkit as a manual option until an official integration agreement and API contract are available.

## Verified provider evidence
| Provider | Official surface found | Practical limitation |
| --- | --- | --- |
| Swiggy Instamart | Official hosted MCP at `https://mcp.swiggy.com/im`. The current public manifest describes location-based product search, cart pricing and bill breakdown, and order placement. | Published checkout support is currently COD only. The OAuth redirect allowlist includes localhost callbacks; additional callback URLs require Swiggy to allowlist them. |
| Swiggy developer APIs | Official developer portal exists. | Its public page did not expose a usable Instamart REST API contract. Partner credentials and actual documentation must be obtained before choosing a REST implementation. |
| Blinkit | No official public consumer shopping/order API was verified. | Blinkit's published terms restrict automated extraction and describe end-consumer eligibility that excludes institutional/B2B users. Obtain written provider approval for this office workflow rather than building on unofficial endpoints. Seller/warehouse integrations do not establish consumer checkout access. |

The Instamart endpoint was read without credentials and returned HTTP 401 with a Bearer challenge pointing at its public protected-resource metadata. That metadata advertises `https://mcp.swiggy.com/auth` as its authorization server and `mcp:tools`, `mcp:resources`, and `mcp:prompts` scopes. This confirms an authenticated MCP surface, not an available static API key or an authorized Innovin connection. The protected-resource document alone does not establish the full OAuth registration/refresh contract.

Sources:
- [Swiggy official MCP manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest)
- [Swiggy developer portal](https://developers.swiggy.com/)
- [Swiggy public protected-resource metadata](https://mcp.swiggy.com/.well-known/oauth-protected-resource)
- [Blinkit terms](https://blinkit.com/terms)

## Proposed first product slice
This section is a recommendation, not a claim about existing implementation.

1. One administrator connects the purchasing account and chooses the office delivery address. Store provider tokens on the server; employees never receive them. Retain the existing company Google identity and admin roles.
2. Add a server-owned provider client for authenticated discovery and product search. Check address serviceability and expose only products available for that office. No credentials in client components or local storage.
3. Store each employee's choices independently in Innovin. Add provider SKU, variant, quantity, price snapshot, requested-by identity, availability state and batch ID. The current `lib/menu.ts` only contains five generic choices, while `app/api/snacks/route.ts` accepts those IDs and replaces a person's daily selection. That contract is not yet a grocery SKU cart.
4. An administrator locks a batch, consolidates quantities, rechecks stock, delivery charges and totals, and explicitly approves the resulting basket. Serialise provider cart writes per purchasing account. Confirm whether the live cart tool replaces the full basket before implementation; that detail was not verified against authenticated tools in this review.
5. Place an order only after explicit admin confirmation. Record the provider order ID and reconcile timeout/unknown outcomes before retrying. Keep actual delivery state distinct from employees' snack requests.
6. Start with search and a reviewable basket. Provider ordering stays disabled until access, production callback registration, current payment support, serviceability and order reconciliation have been verified.

New backend work would require both JSON/Postgres store adapters and shared contract tests. No such provider adapter, live catalog, integration badge or order action was added as part of this research.


## Implementation update - 26 October 2026

The coordinator integration now lives at `/admin/pantry`. See [setup and recovery](../pantry-provider-setup.md). The current official contract supports Cash/COD, UPI and Swiggy Money; the first app slice deliberately enables only live returned Cash/COD methods. OAuth production access and callback approval remain prerequisites. Blinkit partner access is not available, so Blinkit ordering remains disabled. Local fixtures are not proof of provider connectivity.
