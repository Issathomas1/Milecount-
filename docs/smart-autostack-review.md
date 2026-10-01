# Smart AutoStack architecture review — unmerged

AutoStack now treats the stack as one constrained pickup-and-delivery problem. Pickup-before-own-delivery is the only load precedence rule; capacity, supplied real windows and configured driver limits determine which next events are legal. It does not force alternating pairs.

## Road comparison against the current router

The baseline replays the AutoStack function at `ea82ceb82443928c8cb64423a37850260ad3a1d5` on the same selected fixtures, capacities, start and home. Road-matrix comparisons were followed by complete OSRM route responses for both event orders. The table below uses those complete responses, including the home leg.

| Scenario | Current router | Proposed | Saved |
|---|---:|---:|---:|
| Requested Georgia four-load example | 725.5 mi | 643.7 mi | 81.8 mi |
| Florida pickups before leaving Florida | 732.2 mi | 732.2 mi | 0.0 mi |
| Atlanta pickups before Charlotte corridor | 387.2 mi | 314.1 mi | 73.2 mi |
| Capacity release permits next pickup | 851.4 mi | 287.1 mi | 564.3 mi |

## Requested Georgia four-load example

Start: **Riverdale, GA**. Final/home: **Riverdale, GA**. Truck: **10,000 lb / 26 ft**.

1. **PICKUP — Stockbridge, GA** — load C; 1,500 lb / 4 ft onboard.
2. **PICKUP — Newnan, GA** — load A; 3,000 lb / 8 ft onboard.
3. **DROP — Fairburn, GA** — load C; 1,500 lb / 4 ft onboard.
4. **PICKUP — Atlanta, GA** — load B; 3,000 lb / 8 ft onboard.
5. **DROP — Smyrna, GA** — load A; 1,500 lb / 4 ft onboard.
6. **PICKUP — Lawrenceville, GA** — load D; 3,000 lb / 8 ft onboard.
7. **DROP — Charlotte, NC** — load B; 1,500 lb / 4 ft onboard.
8. **DROP — McDonough, GA** — load D; 0 lb / 0 ft onboard.
9. **HOME — Riverdale, GA**; 0 lb / 0 ft onboard.

Collect Georgia pickups before leaving for Charlotte. Because Riverdale is the requested home, McDonough can be delivered on the return. The optimizer minimizes the entire round trip rather than forcing every delivery before leaving the area.

Illustrative test pay: $1,750; base $250; MileCount Added $1,500. Revenue is counted once per unique load, not per event.

## Florida pickups before leaving Florida

Start: **Orlando, FL**. Final/home: **Charlotte, NC**. Truck: **10,000 lb / 26 ft**.

1. **PICKUP — Orlando, FL** — load A; 1,500 lb / 4 ft onboard.
2. **PICKUP — Jacksonville, FL** — load B; 3,000 lb / 8 ft onboard.
3. **PICKUP — Jacksonville, FL** — load C; 4,500 lb / 12 ft onboard.
4. **DROP — Atlanta, GA** — load A; 3,000 lb / 8 ft onboard.
5. **DROP — Greenville, SC** — load B; 1,500 lb / 4 ft onboard.
6. **DROP — Charlotte, NC** — load C; 0 lb / 0 ft onboard.
7. **HOME — Charlotte, NC**; 0 lb / 0 ft onboard.

Collect all three Florida loads before the first drop. Both Jacksonville pickups occur before leaving Florida. This order already worked in the baseline; retaining it is a regression check, not a claimed improvement.

Illustrative test pay: $2,350; base $800; MileCount Added $1,550. Revenue is counted once per unique load, not per event.

## Atlanta pickups before Charlotte corridor

Start: **Newnan, GA**. Final/home: **Charlotte, NC**. Truck: **10,000 lb / 26 ft**.

1. **PICKUP — Stockbridge, GA** — load C; 1,500 lb / 4 ft onboard.
2. **PICKUP — Atlanta, GA** — load A; 3,000 lb / 8 ft onboard.
3. **DROP — Atlanta, GA** — load C; 1,500 lb / 4 ft onboard.
4. **PICKUP — Lawrenceville, GA** — load B; 3,000 lb / 8 ft onboard.
5. **DROP — Greenville, SC** — load B; 1,500 lb / 4 ft onboard.
6. **DROP — Charlotte, NC** — load A; 0 lb / 0 ft onboard.
7. **HOME — Charlotte, NC**; 0 lb / 0 ft onboard.

Collect Stockbridge, Atlanta and Lawrenceville loads before the Greenville/Charlotte corridor. Deliver the Stockbridge load at Atlanta while there. Avoid returning from Charlotte for Atlanta-area pickups.

Illustrative test pay: $1,800; base $1,000; MileCount Added $800. Revenue is counted once per unique load, not per event.

## Capacity release permits next pickup

Start: **Newnan, GA**. Final/home: **Charlotte, NC**. Truck: **3,000 lb / 10 ft**.

1. **PICKUP — Newnan, GA** — load A; 2,000 lb / 6 ft onboard.
2. **DROP — Fairburn, GA** — load A; 0 lb / 0 ft onboard.
3. **PICKUP — Atlanta, GA** — load B; 2,000 lb / 6 ft onboard.
4. **DROP — Greenville, SC** — load B; 0 lb / 0 ft onboard.
5. **PICKUP — Greenville, SC** — load C; 2,000 lb / 6 ft onboard.
6. **DROP — Charlotte, NC** — load C; 0 lb / 0 ft onboard.
7. **HOME — Charlotte, NC**; 0 lb / 0 ft onboard.

Each load is 2,000 lb / 6 ft, while the truck has 3,000 lb / 10 ft. Delivering releases capacity before the next pickup. The old route left the Newnan pickup behind and returned from Charlotte; the new order completes it first.

Illustrative test pay: $1,300; base $200; MileCount Added $1,100. Revenue is counted once per unique load, not per event.

## Architecture and audit

- Independent DOM-free `pickup-delivery.js` owns ordering, capacity transitions, time feasibility, complete-route scoring and replay validation. For 1–6 loads, Pareto-label dynamic programming retains competing paths for each pickup/delivery inventory and endpoint. Larger stacks use a bounded beam; those results are labeled approximate. Stacks above 15 require splitting.
- A directed road matrix is fetched once for all locations. Full road-route legs then replay through the same constraints. The geometry, marker order, Full Route list, road miles, driving duration, fuel, RPM and pay derive from one finalized sequence. Co-located events retain separate identities and stop numbers.
- Total miles dominate the objective. A 5% deadhead tie-break penalty is added. Revenue is invariant among event permutations, so it does not distort geography. A separate marginal-fuel review flags optional loads that make the trip less profitable.
- Actual Truck Brain state and planned endpoints are separate. Planning never moves the real truck. The explicit actual-state interface accepts current location plus known onboard loads; each projected event contains its recomputed inventory and remaining capacity. User-entered free capacity reserves room for unmodeled cargo.
- Onboard loads are delivery-only. Uncollected loads require one pickup and one delivery. Base, onboard and provider-confirmed loads are protected from automatic repair recommendations.
- Feasibility repair recalculates a subset, names each removed load and explains the conflict. The selected load is removed only through the visible repair action. Unknown weight/space, unrecognized broker appointment formats, or appointment clocks without dates/timezones stop readiness instead of guessing.
- Real dates and supplied appointments are constraints; all sandbox/local SIM windows are ignored as broker constraints. Service and road duration are included. Optional single-shift property-carrying limits include remaining driving time, elapsed shift and remaining weekly-cycle budget. No daily restart, sleeper split or exception is invented.
- Final audit rejects missing/duplicate/orphan/stale events, illegal capacity, appointment failures, incorrect final endpoints and dramatically shorter legal alternatives. Selection edits invalidate derived route/map/economics immediately; stale asynchronous map responses cannot redraw deleted freight.

## Validation completed

- `node tests/pickup-delivery.cjs`: precedence, 3 pickups, interleaving, capacity release, region backtracking, revenue uniqueness, real/SIM windows, HOS including home, conflict repair, marginal economics; independent exhaustive comparison on directed matrices.
- `node tests/autostack-workflow.cjs`: real application functions for selection → optimize → audit → Done/finalize → map → remove/rebuild across all four examples; physical Truck Brain stays at its actual location and Homebound starts from the final freight delivery.
- `node tests/verified-road-workflow.cjs`: complete captured OSRM route legs pass through the application audit/finalization/map workflow for all four examples.
- `node tests/map-synchronization.cjs`: exact marker/event order, co-located stops, geometry reuse and stale-response suppression.
- `node tests/performance-regressions.cjs`, JavaScript syntax checks and `git diff --check` passed.
- Stop orders were manually inspected against the listed load pairs, capacities, region order and requested homes. The browser blocked the local review HTML protocol; a signed-in visual application run remains pending before merge. `tests/route-review.html` is a standalone interactive review of the four audited fixture routes.

## Limits that matter before dispatch

Fixtures use illustrative city-center coordinates and test rates, not real broker appointments, confirmed carrier jobs or street-level truck eligibility. OSRM is a development general-driving service, not a production truck-restriction router. The two longer examples exceed a normal single-shift driving budget; enabling that budget rejects the full stack rather than presenting it as legal. Multi-day rest planning, truck restrictions, traffic, ELD status, equipment acceptance and actual broker windows need production inputs before dispatch. Missing data is surfaced, not certified.

Property-carrying limit reference: https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations

**Do not merge the PR just because the code runs. Show me the proposed stop order, total miles, and why the new order beats the old order before merging.**
