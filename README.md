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
