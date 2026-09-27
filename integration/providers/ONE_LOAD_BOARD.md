# One Load Board Provider Adapter

Status: **AWAITING AUTHORIZED ACCESS**

Milecount must not scrape, crawl, bulk-extract, store, redistribute, or use undocumented endpoints from One Load Board.

Source terms reviewed: https://oneloadboard.com/terms

## Requested integration contract

When One Load Board grants authorized API/feed access, normalize each permitted listing into:

```json
{
  "provider": "One Load Board",
  "provider_load_id": "",
  "source_type": "LIVE_LOAD",
  "equipment": "Box Truck",
  "origin": {"city":"","state":"","zip":""},
  "destination": {"city":"","state":"","zip":""},
  "pickup_at": null,
  "delivery_at": null,
  "pay": null,
  "loaded_miles": null,
  "weight_lb": null,
  "commodity": null,
  "requirements": [],
  "posted_at": null,
  "updated_at": null,
  "expires_at": null,
  "source_url": null,
  "booking_mode": "PROVIDER_WORKFLOW"
}
```

## Rules
- Provider source must always display as **LIVE • ONE LOAD BOARD**.
- Never transform a public webpage listing into an API result.
- Never represent a stale cached record as currently available.
- Preserve One Load Board load ID/reference and attribution.
- Remove/expire loads according to provider status or freshness rules.
- Booking/offer actions must use only an authorized endpoint or approved deep link.
- If access is not authorized, the adapter returns no results.
- Simulation results must never use the One Load Board provider name.

## Adapter interface
- searchLoads(query)
- getLoad(providerLoadId)
- getBookingAction(providerLoadId)
- submitOffer(providerLoadId, offer) // only if authorized
- getOfferStatus(requestId) // only if authorized
- subscribeStatus(webhook) // only if authorized

## Current state
Partnership request sent to partnerships@oneloadboard.com. Keep adapter disabled until written/API authorization is received.
