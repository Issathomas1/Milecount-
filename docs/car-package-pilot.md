> Retired from the public app on 2026-10-09. The former car workspace redirects to the cargo van and box truck planner. The implementation notes below are historical.

# Cars and small packages pilot

## Scope and architecture

The car workspace at `/car.html` shares the existing MileCount login, public general-road matrix in `routing.js`, and precedence/capacity/deadline solver in `pickup-delivery.js`. It does not change truck planning, Direct Freight authentication, booking, subscriptions, or backend schema. Entry links are on the truck planner and home page.

`car-planner.js` adapts up to five driver-entered offers awaiting pickup to the existing engine. Cargo space is cubic feet in this workspace. `car-worker.js` keeps subset comparisons off the UI thread. `car-ui.js` stores one versioned local draft per authenticated user and discards stale results after changes. Account changes and competing-tab edits cannot silently overwrite another draft. Saved in-progress edits retain their offer ID. Demo state is temporary and separate; demo inputs cannot be edited into apparently real offers.

There is no connected live package feed and nothing is booked through this pilot. Demo pay, distances and durations are simulated and visibly labeled. Manual route previews use general roads without live traffic. User addresses are sent to the existing geocoding/routing services when calculating a manual route. Local offers are not synced between devices.

## Decisions and economics

- Pickup and delivery locations must remain in the start/finish state. Blank finish returns to start.
- All entered accepted offers remain required. Other offers may be excluded.
- Combining offers requires the driver's explicit indication that each provider permits stacking.
- Supplied deadlines include stop service time. Complete route time includes driving, waits, service and the final trip home.
- Blank car/cost inputs save and use clearly displayed editable planning assumptions. Unknown package size is not claimed verified.
- Estimated net equals driver pay minus fuel, wear, offer fees and trip parking/tolls. Hourly estimates divide by total working time. These figures exclude tax and fixed ownership/insurance costs.
- Rank feasible combinations that meet the hourly goal first, then net, hourly rate and miles. Every subset uses the existing engine's road-score objective; this is the best of compared plans, not a claim of globally optimal net/hour routes.
- No feasible combination yields an actionable explanation without destroying the saved offers. Negative or below-goal results remain labeled as previews.

## Validation

All 18 calculation/regression suites passed locally. Controlled economics case: two permitted offers yield $55 driver pay, six complete-trip miles, 32 minutes and $49.96 after supplied variable costs; a low-paying 120-mile detour is omitted. This is a deterministic fixture, not an earnings claim.

Dedicated mobile browser coverage checks demo isolation, partial autosave, reload during offer editing, account separation, XSS escaping, stale-result invalidation, routing failure/retry and signed-out gating. Existing browser workflows cover truck stack, search, Direct Freight and Local Day. Browser runs use mocked provider responses; they do not establish live API availability.

## Partner inquiries sent October 3, 2026

| Company | Contact/path | Status |
| --- | --- | --- |
| Onfleet | partnerships@onfleet.com, official partnership program | Pilot inquiry sent |
| FRAYT | api@frayt.com, official API contact | Pilot inquiry sent |
| Dispatch | partners@dispatchit.com, published courier partner contact | Technology inquiry sent; not a carrier application |
| Curri | integrations@curri.com, existing integration email thread | Follow-up sent |

Requested authorized driver-side eligible offers, actual driver payouts, package dimensions/windows, acceptance and availability updates, stacking rules, required provider app behavior, sandbox and an Atlanta pilot. Public shipper quote/create-delivery APIs do not establish access to driver earnings opportunities. No package provider approval or active feed is claimed.

## Next changes ranked by impact

1. Obtain a consenting courier/operator or provider agreement and sandbox with real driver payouts. Validate availability, user authorization and acceptance lifecycle before publishing a live feed.
2. Add ready-at windows and provider cancellation/update handling once the first integration schema is known. Replan while retaining actual commitments and onboard packages.
3. Replace public routing/geocoding with an approved production service and quotas before scaling; measure address accuracy, latency and failed routes.
4. Measure complete-shift net/hour against each driver's baseline, with informed pilot participants. Do not promise better earnings than DoorDash without evidence.
5. Add account-synced offers, verified subscription entitlements and store packaging only after the pilot workflow is reliable. No new billing tier is activated by this change.

Rollback: remove the car entry links or revert this release; truck state and backend need no migration or rollback.
