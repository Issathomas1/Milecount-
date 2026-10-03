# Local Day recovery — 2026-10-03

## Cause and scope

The existing static app uses app.js for search/selection state, Truck Brain for persisted physical state and commitments, pickup-delivery.js for complete-plan optimization, and the shared routing boundary for road matrices and final-route audits. Direct Freight is authenticated per driver through the existing Supabase adapter. The repository architecture and larger roadmap remain in commercial-dispatch-review.md and production-roadmap.md.

Local Day previously issued up to 40 independent route checks with five-second deadlines. A valid six-second road response excluded every candidate from automatic selection. Its progress messages remained on the hidden first screen. It did not invalidate initial board searches, and persisted Truck Brain home could override the requested local return. Direct Freight searched all destination states before client-side filtering, so outbound loads could fill the returned pages.

## Impact-ranked implementation

1. Verify the chosen load combination through one matrix and final-route audit. Keep the 600-minute local driving target, capacity/appointment checks, protected bookings and physical onboard state. Give the entire local optimizer a 30-second deadline, releasing controls and preserving selections on failure.
2. Ask Direct Freight for the destination state before pagination; independently require both pickup and drop in the selected state. Keep unpriced loads visible for manual selection. Never turn SIM into live freight.
3. Invalidate old discovery generations, suppress late optimization results, and preserve intervening driver selections. Set the canonical return location explicitly for Local Day without moving the physical truck.
4. Put progress/empty/error outcomes and retry on the visible results screen. Open My trip when the audited local plan is ready.

## Proof

The mobile Chromium regression fails on the previous app with `No verified paid same-day match` when valid road responses take six seconds. The repaired workflow creates an in-state round trip and opens My trip. The illustrative Georgia fixture produces three loads, $750 planned pay and about 195 road miles; these are QA fixtures, not available freight or earned revenue.

The new browser suite covers slow routing, zero local inventory, provider outage then successful retry, missing rates with working Stack controls, and an older background search returning after Local Day. Adapter contract tests verify state filters on both pages and unchanged ordinary search/auth isolation. Unit tests cover optimizer deadline cleanup and rejection of late/cancelled results. Full existing browser and unit regressions also run in CI.

## Limits

This fixes discovery/build reliability; it does not create inventory, authorize bookings, or certify truck-restriction coverage. General road routing stays labeled as an estimate. Provider search is bounded, and automatic selection considers up to five candidates (subject to subscription limits), not every possible combination in the market. Unknown starting cities/states require an explicit location. Live authenticated inventory counts require a signed-in user session.
