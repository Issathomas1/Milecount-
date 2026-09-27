# Milecount Live Freight Integration Contract

## Goal
Every approved freight provider maps into one normalized Milecount load object. The UI never needs provider-specific fields.

## Search request
```json
{
  "origin": "Atlanta, GA",
  "destination": "Anywhere, USA",
  "pickup_date": "YYYY-MM-DD",
  "equipment": "box26",
  "max_deadhead_miles": 100,
  "min_rpm": 0,
  "available_space_ft": 14,
  "available_weight_lb": 6200
}
```

## Normalized load
```json
{
  "id": "provider:external-id",
  "provider": "123Loadboard",
  "provider_load_id": "external-id",
  "status": "LIVE",
  "origin": {"city":"Atlanta","state":"GA","zip":null},
  "destination": {"city":"Dallas","state":"TX","zip":null},
  "pickup_at": null,
  "delivery_at": null,
  "equipment": "Box Truck",
  "rate": 1800,
  "loaded_miles": 780,
  "deadhead_miles": 22,
  "weight_lb": 6200,
  "space_ft": null,
  "commodity": null,
  "broker_name": null,
  "booking_reference": null,
  "booking_url": null,
  "source_updated_at": null
}
```

## Provider adapter interface
Each adapter implements:
- `searchLoads(query)`
- `normalizeLoad(raw)`
- optional `getRate(query)`
- optional `bookLoad(id)`
- `health()`

## Providers in outreach / integration pipeline
- 123Loadboard
- Direct Freight
- Truckstop
- Trucker Path
- Loadsmart
- Parade
- DAT
- CoyoteGO

## Safety / data rules
1. Provider credentials stay server-side only. Never commit API keys to GitHub or expose them in browser JavaScript.
2. Every returned load must carry provider attribution.
3. LIVE is only used for a successful authorized provider response.
4. Synthetic/demo freight is always labeled SIMULATION.
5. No simulated load may be silently mixed into a live provider response.
6. If all providers fail or return zero loads, show that state clearly before offering simulation.
7. Deduplicate equivalent loads before ranking.
8. Milecount economics (deadhead, all-mile RPM, fuel, break-even, estimated margin) are calculated after normalization.

## Nationwide search
The UI accepts City, ST or ZIP for origin/destination. `Anywhere, USA` is a valid open destination intent. Production geocoding should resolve the typed location before provider calls and preserve the user's requested deadhead radius.

## Ranking pipeline
authorized providers -> normalize -> deduplicate -> route/deadhead -> fuel -> all-mile RPM -> estimated margin -> capacity fit -> rank -> display with source.
