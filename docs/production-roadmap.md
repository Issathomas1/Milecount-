# MileCount Production Roadmap

## Product frozen
Driver MVP is the stable baseline. New business features should not be patched into the driver engine without testing.

## Backend
- Supabase Auth/Postgres/RLS
- vehicles, trips, analyzed_loads, subscriptions
- app_events analytics
- partner_referrals
- freight_sources

## Freight normalization contract
Every provider should normalize to:
- external_id/source
- pickup city/coordinates/time window
- delivery city/coordinates/time window
- pay
- weight_lb
- length_ft / dimensions
- vehicle requirements
- commodity / handling notes
- booking URL or provider reference when contractually allowed

## Monetization
- Free
- Pro proposed launch price: $19.99/month
- Pro annual proposed: $199/year
- Fleet later
- No percentage-of-freight fee in initial SaaS launch

## Partnerships
Prioritize authorized freight data, fuel cards, insurance, factoring, rentals/leasing, maintenance/tires, ELD/telematics, carrier groups.

## Launch metrics
Activation, weekly retention, loads analyzed, recommendation acceptance, all-miles RPM, estimated margin, empty miles avoided, Pro conversion.
