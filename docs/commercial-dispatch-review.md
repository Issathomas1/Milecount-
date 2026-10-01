# Commercial dispatch architecture and launch review

Status: implementation branch for review; NOT production-ready commercial navigation.
No production migration, routing service, paid billing change or percentage fee was deployed.
Owner `Issa.bj99@yahoo.com` already has the authenticated server admin role. Email matching
and browser flags are not used to grant that role.

## Architecture implemented on this branch

- `truck-brain.js`: measured commercial profile, physical position, onboard freight,
  released/consumed capacity, current gross weight, pending commitments, home/deadline,
  duty/guardrail fields and idempotent pickup/delivery events. Plans never move the truck.
- `brain-storage.js`: account/vehicle namespaces, local persistence, serial cloud saves,
  optimistic version checks and explicit local-only/conflict status. The first UI currently
  operates `vehicle1`; assigning and switching fleet vehicles is a separate remaining step.
- `pickup-delivery.js`: exact Pareto-label search through six loads, bounded beam search
  above six, legal pickup/drop interleaving, independent replay audit, real windows/HOS,
  revenue uniqueness, alternate comparison and specific repair recommendations. Stacks
  above fifteen require splitting. LIVE and TEST/SIM plans cannot be mixed.
- `dispatch-brain.js`: carrier-first whole-plan economics, configurable guardrails,
  fee-independent ranking and a stale-safe event coordination interface.
- `commercial-routing.js`: shared matrix/route boundary, explicit profile validation,
  truck request serialization, exact per-leg gross weights and honest failure labels.
- `routing.js`: existing map/AutoStack/Homebound/Strong Fit route calls pass this boundary.
  OSRM remains a general estimate, never commercial qualification.
- `commercial-route`: draft authenticated, entitlement-checked, quota-controlled server
  adapter for private Valhalla. The matrix uses GVWR conservatively; the final route
  replays exact cargo gross weight at each leg. Every result is experimental. Actual
  axle redistribution after loading requires driver verification; it is not inferred.
- `app.js`: physical event updates replan the remaining route and refresh existing live
  connections. It does not automatically accept or book a new load. Whole-inventory
  candidate/subset recommendation and a fleet assignment dashboard remain unfinished.

## Provider decision

Build MileCount's routing interface and dispatcher; evaluate self-hosted Valhalla behind
it as requested. This is ownership of our integration and optimization, not a claim that
we have created or verified a nationwide commercial-road restriction database.

For a production managed provider, Trimble remains the strongest technical candidate
for a US trucking focus, subject to a written API/navigation quote and agreement.

| Provider | Truck restriction/profile capabilities | Optimization / navigation | Pricing / limits decision |
|---|---|---|---|
| Trimble Maps / PC*Miler | Truck profiles; measured height, width, length, gross weight, axles, maximum axle weight, trailers; commercial restrictions and hazmat options depend on product/region | Directions/matrix APIs; CoPilot navigation separately licensed | Obtain API and navigation quotes. Desktop PC*Miler pricing is not an API quote |
| HERE | Truck dimensions, weights, axle restrictions, tunnel/hazmat options, toll/traffic data; warnings/violations require inspection | Routing/matrix/waypoint products; navigation SDK separately reviewed | Standard Limited/Base terms exclude asset-management uses. MileCount needs an applicable agreement; do not assume free-tier eligibility |
| TomTom | Truck dimensions/weight, commercial status, load types and tunnel restrictions; region/product coverage needs confirmation | Traffic-aware route APIs, waypoint options, navigation SDK | Verify live API tariff, account QPS, optimization and navigation licenses; no unverified price copied into MileCount billing |
| Self-hosted Valhalla | Truck costing uses available OSM dimension/access/hazmat tags; measured dimensions and axle load supported | Matrix, route geometry, maneuvers; MileCount solves pickup/delivery ordering | Open software does not include free hosting, maintained restriction completeness, traffic or operational navigation |

Primary sources reviewed October 1, 2026:
- https://developer.trimblemaps.com/restful-apis/developer-guide/how-to-guides/vehicle-routing-profiles/
- https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases
- https://developer.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route
- https://developer.tomtom.com/store/maps-api
- https://valhalla.github.io/valhalla/api/route/api-reference/

No provider was purchased or represented as a MileCount partner. Low bridges, commercial
bans, tunnels and vehicle-class restrictions are only as complete as the licensed data.
The conservative matrix may miss an opportunity available at a lighter actual weight;
state-dependent matrices/traffic timing need production evaluation before claiming an
exact global commercial optimum. Unknown cargo/axle state prevents qualification.

## Actual subscription audit and recommendation

| Existing UI plan | Displayed monthly price | Trucks | Stack limit | Flags found in code |
|---|---:|---:|---:|---|
| Basic | $19 | 1 | 3 | Basic route/economics |
| Gold Pro | $39 | 1 | 5 | Homebound, Strong Fit |
| Premium Pro | $69 | 1 | 10 | Gold plus Auto-Correct |
| Platinum Pro | $129 | 5 | Previously unlimited; solver maximum is 15 | Fleet flag plus other flags |
| Server admin | Full access | No subscription truck cap | No subscription stack cap; technical maximum still 15 | All flags |

Browser storage previously selected paid plans; pricing buttons granted their preview
flags. Homebound and Auto-Correct lacked entry checks. This branch reads authenticated
server entitlements, gates those entries, disables browser activation and states the
real optimization maximum. Existing backend values `free/pro/fleet` do not uniquely map
to four new paid tiers. Do not guess that mapping or change existing charges.

The draft migration provides entitlements, owner bypass, atomic truck-count enforcement,
cloud state CAS and server-only quota reservation. Its RLS/SQL/concurrency behavior must
be tested in staging before deployment. Existing cost-saving profile saves now update
the default vehicle rather than inserting another truck on every save.

Recommend Basic / Gold / Premium / Fleet with commercial routing as a metered Premium
or GPS add-on and fleet seats. Keep proposed prices unchanged until unit costs are known:

`net contribution = subscription - card/recurring-billing fees - routing/matrix/geocoder/
map/navigation usage - authorized freight-provider fees - infrastructure/support`.

Measure matrix cells, route legs, refresh frequency, users/trucks and cache hit rates.
Set quotas from an actual host/provider quote, not assumed free requests. Commercial
endpoint quota defaults to unavailable until configured. No Stripe products or charges
were changed. Backend webhook-v2 signing-secret handling and both legacy webhook tier
mappings need replacement and secret rotation before billing activation; no secret is
included in this branch or report.

## Per-load fees and booking decision

Do not enable 1%, 2%, 3%, flat success fees or provider revenue share without reviewing
actual agreements and the operational model. A percentage versus flat price alone does
not decide broker status. Soliciting freight, allocating among carriers, accepting
shipper payment and arranging transportation can affect the FMCSA analysis.

FMCSA primary guidance:
- https://www.federalregister.gov/documents/2023/06/16/2023-13080/definitions-of-broker-and-bona-fide-agents
- https://www.fmcsa.dot.gov/registration/broker-registration

Private DAT, Truckstop, Direct Freight, other provider and navigation agreements were
not supplied. Public API documentation is not redistribution/booking approval. The
preferred initial model is subscriptions, GPS/optimization add-ons and fleet seats.
Enterprise licensing and approved provider referrals can follow separately. Ranking
never reads MileCount revenue. A future allowed fee requires an explicit pre-confirmation
carrier-net breakdown and Billing/Terms disclosure; there is no hidden fee in this build.

All currently registered booking adapters remain handoff-only until a server-verified
provider receipt integration exists. Browser `ACCEPTED` flags, legacy saved records and
manual planner entries cannot create a provider-confirmed booking. Manual planner trips
are `planned`; self-reported handoffs remain visibly self-reported.

## Route examples reviewed

These are captured OSRM/general-road examples, not commercial safety certifications.

| Example | Old paired-route miles | New miles | Result |
|---|---:|---:|---|
| Requested Georgia four loads | 725.5 | 643.7 | 81.8 fewer miles; legal interleaving and shared local stops |
| Florida pickups before leaving | 732.2 | 732.2 | Three pickups precede deliveries; no Florida return |
| Atlanta → Charlotte corridor | 387.2 | 314.1 | Nearby pickups collected before departure; 73.1 fewer miles |
| Capacity release | 851.4 | 287.1 | Delivery releases capacity before next pickup; 564.3 fewer miles |

Georgia order: Riverdale → Stockbridge pickup C → Newnan pickup A → Fairburn drop C →
Atlanta pickup B → Smyrna drop A → Lawrenceville pickup D → Charlotte drop B →
McDonough drop D → Riverdale home.

Florida order: Orlando pickup A → Jacksonville pickup B → Jacksonville pickup C →
Atlanta drop A → Greenville drop B → Charlotte drop C → Charlotte home.

See `smart-autostack-review.md` and captured fixtures for exact per-event miles/economics.
The optimizer does not force a visually attractive pickup-first order when legal
capacity, supplied appointments or a complete route comparison favor an interleave.

## Verification and remaining launch gates

Local tests cover global search versus exhaustive enumeration, multiple pickups,
capacity release, stale-load removal, exact map/list/economics synchronization, unique
pay, physical event replanning, account isolation/CAS conflict retention, profile
serialization, honest fallback, rejected restriction warnings, carrier-first ranking,
subscription tampering/admin access and unverified booking rejection.

Unfinished / not verified:
1. Real hosted truck router and current restriction datasets; independent low-bridge,
   road-ban, weight/height/tunnel/hazmat route tests. No Docker/runtime was available
   here to host a real Valhalla dataset. Serializer tests are not restriction tests.
2. Staging deployment of SQL/Edge Function, RLS tests, concurrent quota/truck insert
   tests, authenticated browser smoke test and current commercial provider agreements.
3. Active turn-by-turn GPS: foreground/background location, rerouting, voice, offline,
   driver-safe UI and traffic/ETA validation. Returning maneuvers is not navigation.
4. State-dependent routing matrices, multi-day HOS rest/cycle rules, detailed dimensions/
   axle distribution, verified entrance coordinates and toll cost feeds.
5. Fleet vehicle switching/assignment, comprehensive best-next-load subset ranking,
   homebound opportunity automation, explicit profit override, maximum-detour UI and
   actual completed-trip operating-cost/earnings ledger. Event routes currently represent
   the remaining dispatch plan; completed-trip financial totals need a ledger.
6. Stripe webhook rotation, secure price-ID mapping, signed billing activation and
   private API booking receipt workflows. Provider failure/empty-inventory distinction
   needs tightening in legacy adapters, which still catch some failures as empty arrays.

Merge authorization has been given for finished work. This branch is intentionally a
draft because the required commercial-road and end-to-end launch gates have not passed.

Do not merge the PR just because the code runs. Show me the proposed stop order, total miles, and why the new order beats the old order before merging.
