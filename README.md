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
