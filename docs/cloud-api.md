# MileCount Cloud V1 API contract

All production endpoints require authenticated users. Freight-provider credentials and billing secrets stay server-side.

## Identity
GET /v1/me

## Vehicles
GET /v1/vehicles
POST /v1/vehicles
PATCH /v1/vehicles/:id

## Trips
GET /v1/trips
POST /v1/trips
GET /v1/trips/:id

## Load analysis
POST /v1/loads
GET /v1/loads

## Subscription
GET /v1/subscription

## Future freight integrations
GET /v1/freight/search
POST /v1/freight/optimize

Never expose provider API keys, Stripe secret keys, or broker credentials in browser JavaScript.
