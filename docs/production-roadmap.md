# MileCount delivery roadmap — October 1, 2026

Mission: Make Every Mile Count. Recommend the best complete carrier plan, not the highest-paying isolated load.

## Architecture and duplicate-state audit

The shipped app is a static GitHub Pages client with Supabase Auth, Postgres/RLS and provider Edge Functions. `app.js` previously combined search, paired routing, physical truck assumptions, booking flags and financial totals in its mutable `S` object. Maps and Homebound could create new stops independently. Browser plan flags and old Stripe links were not a reliable subscription system.

The dispatch release separates these concerns:

- Truck Brain owns measured vehicle data, actual location, onboard cargo, commitments, bookings, home/deadline, guardrails, provider inventory and an audited route projection. Input version changes invalidate that projection; a separate revision orders cloud persistence.
- Provider Inventory represents fresh, empty, failed and stale results separately. Stale inventory cannot become a recommendation. Existing provider attribution and references survive normalization.
- The pickup/delivery solver compares complete legal event orders. Dispatch Planner evaluates bounded subsets, including paid homebound hops, using the same directed road matrix and carrier economics.
- CPU-heavy searches run in a Web Worker with a time limit. Search bounds are disclosed. Main-thread route audit independently verifies the chosen result before publication.
- The route list, final map geometry, mileage and projected economics consume that finalized sequence. Legacy screen fields remain rendering adapters; a planned stop does not move the physical truck.
- Supabase owns admin membership, paid entitlements, truck limits and version-checked persistence. A user cannot grant themselves admin through an email string or browser plan flag.

## Ranked implementation sequence

| Priority | Work | Driver benefit | State / gate |
|---|---|---|---|
| 1 | Global pickup/delivery ordering, exact capacity release, independent audit | Fewer wasted miles and impossible stacks | Implemented; four captured road examples plus browser workflows |
| 1 | Canonical physical state, persistent projection, distinct carrier claims | No fictitious movement, stale routes or fake bookings | Implemented for one active vehicle; PostgreSQL tenant/CAS/admin tests |
| 1 | Whole-plan Best Next Move and multi-hop Homebound | Compare net carrier value across compatible freight | Implemented bounded search; provider availability/appointments still need confirmation |
| 1 | Worker isolation and provider failure states | Usable interface during optimization; trip survives service outages | Implemented; provider and stale-result tests |
| 2 | Licensed commercial routing and navigation | Restriction-aware driving with reliable truck data | Requires account/contract or hosted validated data; general-road fallback remains explicit |
| 2 | Unified scheduling/ELD and multi-day HOS | Trustworthy appointment/home-deadline feasibility after real driving | Single-shift supplied constraints exist; ELD, rest/cycle recapture and live duty tracking remain |
| 2 | Secure billing activation and server-hosted optimization entitlements | Clear paid value and reliable access | Existing prices audited; no charges changed. Rotate legacy webhook secret and map approved Stripe prices before checkout |
| 3 | Fleet switching, assignment and fleet optimization | Make best decisions across several trucks/drivers | Not implemented; current active state is `vehicle1` |
| 3 | Provider-confirmed booking receipts | Complete booking without falsely claiming success | Current integrations use provider handoff and explicit carrier-reported claims |
| 3 | Operating-cost ledger, profit override with reason, deeper replacement search | Actual realized profitability and explainable exceptions | Projected fuel/maintenance economics and completed-load events exist; full accounting/override workflow remains |

## Getting each part live

1. Publish the tested static assets together. Confirm the deployed asset revision, not only the Git merge result.
2. Apply the versioned Truck Brain/entitlement migration, then check RLS, tenant access and the existing owner admin record. Keep provider secrets server-side.
3. Deploy the routing boundary with authentication. With no configured backend it returns unavailable and the client labels the general-road estimate. It must never report commercial qualification merely because a route returned.
4. For managed truck GPS, obtain a Trimble API/navigation quote and agreement covering MileCount's SaaS use. Confirm US restriction coverage, matrix billing, waypoint/volume limits, customer navigation rights and support. Alternative: review TomTom's truck/API and navigation licensing for the same scope. HERE requires an applicable asset-management agreement.
5. For MileCount-hosted routing, provision a private Valhalla service, current OSM/regional restriction data, updates, monitoring and a monthly operating budget. Configure the server URL/token, dataset version and per-user quota. It remains experimental until independent restriction tests pass.
6. Run known low-bridge, weight-limit, prohibited-road, tunnel/hazmat and entrance-location cases with measured vehicles; review violations. Then validate voice/off-route/background/offline navigation. A route API response alone is not finished GPS.
7. Enable commercial qualification only for a verified provider/coverage configuration. No account, dataset or pricing agreement is invented by this release.

## Cost and monetization decision

Actual repository UI prices are Basic $19 / Gold Pro $39 / Premium Pro $69 / Platinum Pro $129 monthly, with stack caps 3/5/10/15 and truck caps 1/1/1/5. Existing database subscriptions inspected were inactive/free. The old $19.99 monthly/$199 annual links conflicted with these plans and have been removed from the app. Unsubscribed users still have Basic-level preview access; this is not a charged subscription. Client-side optimizer gates are product controls, not tamper-proof server metering. Commercial routing entitlement/quota checks are server-side.

Current public US Stripe rates reviewed: domestic card processing 2.9% + $0.30, plus pay-as-you-go Billing 0.7% of billing volume. At $39 these two fees total about $1.70, leaving $37.30 before API, infrastructure, support, tax/refunds or other costs. Supabase Pro starts at $25/month with $10 compute credits; actual project/usage costs must be checked separately. These are public tariffs, not the user's invoice.

TomTom's current public page advertises 20K monthly Routing requests and 2.5K Matrix requests in its free allowance; product units, paid tiers, quotas and MileCount's permitted use still require account-specific verification. A 6-load problem plus start/home contains up to 14 locations and 196 directed cells. Four rebuilds consume 784 cells before inventory planning. At 100 trucks and 22 working days that is 1,724,800 cells/month; this illustrates why a matrix 'request' must not be assumed to equal one cell or one trip. Navigation SDK, geocoding, map tiles and traffic may be separately metered. No API cost is assumed to be zero.

Prefer subscriptions, per-truck/fleet seats and a metered commercial-navigation add-on. Keep all pricing unchanged until quotes and usage measurements support a margin budget. Do not activate 1%, 2%, 3%, flat success fees or provider revenue share without the actual provider agreements and freight-role review. Pricing shape alone does not determine broker status. Carrier route ranking never reads MileCount fees/revenue. Any future permitted booking fee requires the exact amount and carrier net before confirmation, plus Billing/Terms disclosure.

## Competitor principles, redesigned for MileCount

| Product / primary source | Problem solved and value | MileCount interpretation |
|---|---|---|
| [DAT](https://www.dat.com/carrier-load-board) | TriHaul helps identify more productive round trips | Compare several paid homebound hops against the complete existing plan, including capacity/windows |
| [Truckstop](https://truckstop.com/product/load-board/carrier/) | Load discovery and carrier booking tools reduce search friction | Keep source/reference/action clear; expose only the booking method actually authorized |
| [Amazon Relay](https://relay.amazon.com/) | Carrier eligibility and direct booking establish an operational workflow | Separate discovery, eligibility, handoff and actual confirmation. Relay says its loads are tendered directly through Relay, not third-party boards |
| [Uber Freight bundles](https://www.uberfreight.com/en-US/blog/uber-freight-load-bundles) | Pairing a load with a reload reduces uncertainty about the next move | Generalize the idea to multiple legal pickups/drops and carrier profit. This older product article is a design principle, not current API permission |
| [123Loadboard Market Rates](https://www.123loadboard.com/faq/rate-check/) | Rate context helps carriers assess an offer | Add authorized rate intelligence to whole-trip after-cost economics; never manufacture a missing rate |
| [Trucker Path routing profiles](https://helpcenter.truckerpath.com/hc/en-us/articles/38760911534733-Routing-Profiles) | Vehicle dimensions and hazmat settings personalize routing | One persistent verified profile for every calculation and exact per-leg cargo state |
| [LoadStop](https://loadstop.com/) | Capacity planning, lane profitability and exception monitoring help dispatchers act earlier | A concise Best Next Move with the reason, impact and explicit constraints for a small fleet |
| [Parade](https://www.parade.ai/) | Capacity matching reduces manual matching effort for brokers | Reuse matching principles around carrier benefit; do not adopt broker incentives in driver rankings |

Other primary sources reviewed October 1, 2026:
- https://stripe.com/pricing
- https://supabase.com/pricing
- https://docs.tomtom.com/pricing
- https://developer.trimblemaps.com/restful-apis/developer-guide/how-to-guides/vehicle-routing-profiles/
- https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases
- https://valhalla.github.io/valhalla/api/route/api-reference/
- https://www.federalregister.gov/documents/2023/06/16/2023-13080/definitions-of-broker-and-bona-fide-agents
- https://www.fmcsa.dot.gov/registration/broker-registration

Do not merge the PR just because the code runs. Show me the proposed stop order, total miles, and why the new order beats the old order before merging.
