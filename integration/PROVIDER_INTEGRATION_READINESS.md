# Milecount Provider Integration Readiness

Milecount is structured so an approved freight provider can be added without exposing credentials in the browser or mixing provider-specific logic into the UI.

## Current integration posture
- Live provider calls are made server-side.
- Provider credentials must stay in server-side secrets only.
- Every live result carries provider attribution.
- LIVE and SIMULATION data are kept separate.
- Provider availability and booking remain authoritative at the source.
- Nationwide City / State / ZIP search is supported by the Milecount UI.
- Milecount calculates deadhead, all-mile RPM, fuel, break-even, capacity fit and estimated trip economics after provider normalization.

## What Milecount needs from a provider
1. Sandbox or developer credentials.
2. Base URL and authentication method.
3. Load-search endpoint and supported filters.
4. Equipment-type values, especially cargo van, Sprinter and 16–26 ft box truck where supported.
5. Rate limits and pagination rules.
6. Freshness / caching requirements.
7. Attribution and deep-link requirements.
8. Stable load ID and source-updated timestamp.
9. Production approval requirements.
10. Optional booking/request endpoints, status endpoints and approved webhook/callback documentation.

## What Milecount can provide to a provider
- Live pilot URL: https://issathomas1.github.io/Milecount-/
- Server-side adapter architecture.
- Source attribution in every load result.
- Provider-controlled booking/handoff.
- Separate test/simulation labeling.
- Controlled beta before broad carrier launch.
- Provider-specific compliance controls for caching, attribution and display.

## New-provider onboarding checklist
Before activating any provider in production:
- [ ] Provider has granted written API/feed authorization.
- [ ] Sandbox credentials are stored only in server-side secrets.
- [ ] Sandbox base URL and authentication are verified.
- [ ] Search request is mapped into Milecount's normalized query.
- [ ] Raw response is mapped into the normalized load contract.
- [ ] Provider name appears on every live result.
- [ ] Required provider deep link is present.
- [ ] Cache / refresh interval matches provider terms.
- [ ] Zero-results and provider-error states do not silently substitute simulation.
- [ ] Rate-limit handling is implemented.
- [ ] Duplicate loads are deduplicated before ranking.
- [ ] Booking is enabled only if provider explicitly authorizes it.
- [ ] Production credentials are separate from sandbox credentials.
- [ ] Provider has reviewed the live Milecount build if required.

## Normalized live-load minimum
Each live load should preserve:
- provider
- provider_load_id
- source_updated_at
- origin
- destination
- pickup date/time
- delivery date/time when available
- equipment
- rate
- loaded miles when supplied
- weight / dimensions when supplied
- booking_reference or booking_url when authorized
- provider attribution text

See `LIVE_PROVIDER_CONTRACT.md` and `BOOKING_STATE_CONTRACT.md` for the full interface and booking-state rules.
