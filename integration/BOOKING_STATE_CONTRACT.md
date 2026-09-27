# Milecount Booking State Contract

Milecount never treats a button tap as a booked load unless the source confirms it.

## States
- AVAILABLE: provider says the load is currently available
- REQUESTING: request is being submitted
- PENDING: provider/broker received the request and has not decided
- ACCEPTED: provider returned authoritative confirmation
- DECLINED: provider/broker rejected the request
- EXPIRED: load/request is no longer valid
- ACTION_REQUIRED: provider does not expose booking; carrier must contact posting party

## Provider adapter booking methods
Optional per adapter:
- requestLoad(providerLoadId, carrier)
- getRequestStatus(requestId)
- cancelRequest(requestId)
- getBrokerContact(providerLoadId)

## Response contract
{
  "provider": "Provider",
  "provider_load_id": "123",
  "request_id": "abc",
  "status": "PENDING",
  "submitted_at": "ISO-8601",
  "expires_at": null,
  "confirmation_number": null,
  "message": "Waiting for provider confirmation"
}

## UI rules
1. Never display BOOKED/ACCEPTED from local state alone.
2. Disable duplicate requests while REQUESTING/PENDING.
3. Show provider/source and load reference throughout.
4. Poll only where the provider permits it; prefer webhooks/callbacks for fast confirmation.
5. When ACCEPTED, freeze the accepted load snapshot into the trip.
6. If DECLINED/EXPIRED, return the driver to alternatives without losing the search.
7. For providers without booking APIs, show ACTION REQUIRED and broker contact/reference instead of a fake accept flow.

## Fast-response architecture
Milecount UI -> Supabase booking edge function -> provider booking API -> provider request ID.
Provider webhook/callback -> Supabase booking status -> realtime update -> Milecount ACCEPTED/DECLINED.
Fallback where webhooks are unavailable: provider-approved status polling with backoff.

## TrukTek
Current published developer docs support public/authenticated search, rate checks, load chaining, mileage, Bandit and enterprise integration. Do not claim direct booking until TrukTek provides a documented/authorized booking endpoint. Use broker verification/contact workflow in the meantime.
