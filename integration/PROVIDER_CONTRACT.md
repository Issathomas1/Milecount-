# MileCount Provider Integration Contract

MileCount accepts provider freight through adapters. Provider data is normalized before AutoStack sees it.

## Required
- provider_load_id
- pickup_city
- delivery_city
- pay

## Recommended
- pickup_lat / pickup_lng
- delivery_lat / delivery_lng
- pickup_start / pickup_end
- delivery_start / delivery_end
- weight_lb
- length_ft
- vehicle_types
- expires_at
- booking_reference

## Rules
- Provider credentials stay server-side.
- Provider remains the source of truth for availability and booking.
- Repeated provider records are fingerprinted and de-duplicated.
- Re-seen loads refresh last_seen_at rather than creating another opportunity.
- Malformed rows are rejected and counted.
- Every ingestion produces a provider_sync_runs audit record.
- Browser users cannot directly read provider source/configuration tables.

## Adapter boundary
Provider API / CSV / broker feed -> adapter -> provider-ingest -> freight_opportunities -> AutoStack.

The optimizer must only consume normalized freight_opportunities, never provider-specific payloads.
