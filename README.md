# Milecount

AI-powered trip optimization for box truckers — stack freight, reduce empty miles, find backhauls, and get home paid.

## Live pilot
https://issathomas1.github.io/Milecount-/

## Freight-provider integrations
Milecount is built for authorized provider feeds with server-side credentials, normalized live-load data, source attribution, clear LIVE vs SIMULATION separation, and provider-controlled booking/handoff.

Provider integration materials:
- [Provider integration readiness](integration/PROVIDER_INTEGRATION_READINESS.md)
- [Live provider contract](integration/LIVE_PROVIDER_CONTRACT.md)
- [Booking state contract](integration/BOOKING_STATE_CONTRACT.md)
- [LoadBoot integration profile](integration/providers/LOADBOOT.md)

## Architecture
Provider feed → server-side adapter → normalized freight → vehicle/capacity filter → routing/economics → AutoStack → permitted booking/handoff.

Milecount does not treat simulated freight as live freight and does not expose provider credentials in client-side code.

### Dispatcher release verification

`npm ci --ignore-scripts && npm test` runs the route, truck-state, economics, access,
PostgreSQL permission and routing-endpoint suites. For the full static application:
`npx playwright install chromium && npm run test:browser`.
The browser tests use mocked service responses and captured general-road fixtures;
they do not claim truck-restriction coverage or perform real bookings.

See [the current delivery roadmap](docs/production-roadmap.md) for release scope,
commercial-navigation activation, pricing/contract gates and the competitor review.
See [route-quality evidence](docs/smart-autostack-review.md) for exact stop orders
and paired-route comparisons. Commercial navigation is not active in this release.


## Courier Gig Hub (early-access)

The separate [Courier Gig Hub](./courier.html) includes a profit estimator, local direct-opportunity tracking, manual earnings records, JSON export, and optional sync for authenticated MileCount users. The courier page does not ingest or advertise third-party gigs as live unless an authorized provider API is integrated. Provider directory links send drivers to the provider's own onboarding page. Courier opportunity and earnings tables use authenticated-user row-level security; do not expose service-role keys in the browser.

Courier browser regression checks are included in `npm run test:browser`.
