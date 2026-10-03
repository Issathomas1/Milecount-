# Argyle account connections

The Accounts section of `car.html` uses the existing MileCount login. The
`argyle-connect` Edge Function verifies the bearer token with Supabase Auth before
reading account information or issuing a short-lived Argyle Link token. The
mapping table is service-only, RLS enabled, and keyed by user and environment.
Client-supplied user IDs are never used for ownership. Reconnect and disconnect
verify the account owner upstream before acting. The frontend holds the Link
token in memory only and loads Argyle's SDK only after explicit consent.

## Activation

Set these secrets on the existing Supabase project, using its secret manager:

- `ARGYLE_API_KEY_ID` and `ARGYLE_API_KEY_SECRET`: the matching environment's pair.
- `ARGYLE_ENVIRONMENT`: `sandbox` or `production`; defaults to sandbox.
- `ARGYLE_FLOW_ID`: a reviewed embedded Link flow limited to the required gig
  activity. Disable deposit switching, document uploads, banking and unrelated
  identity/payroll collection. Confirm the product's permitted use with Argyle.
- `ARGYLE_ITEMS_JSON`: an object mapping `instacart` and/or `spark`
  to their actual verified Argyle Item IDs. Omit unsupported platforms. Check
  each Item's field coverage, health, known limitations and refresh interval in
  Argyle Console / Coverage. Never guess IDs or enable unsupported items.
- `ARGYLE_PRODUCTION_ENABLED=true`: set only after provider access/use approval,
  real-data consent review, and a successful authorized pilot. Production keys
  alone do not enable live connections.
- Optional `ARGYLE_ALLOWED_ORIGINS`: comma-separated additional exact app origins.

Apply the committed migration and deploy `supabase/functions/argyle-connect`.
Use `verify_jwt=false` because the handler itself verifies all personal-data POST
requests using `/auth/v1/user` and supports the current publishable key. The GET
readiness response exposes only non-personal configuration flags. An absent
credential, flow or Item map returns an honest awaiting-activation state.
No secret values belong in JavaScript, GitHub, this document, or chat.

## Behavior and boundaries

- Link, reconnect, authenticated status, completed delivery activity and
  disconnect/delete are implemented using Argyle's documented v2 APIs.
- The adapter creates an Argyle user only after consent and never sends the
  MileCount email, driver password, SSN, bank information or precise location.
- An atomic per-user/environment lease serializes provider calls and rate limits
  repeated clicks. Sandbox and production user IDs are distinct.
- The page checks for newly available provider records every minute while
  visible. This is NOT a request to force Argyle to scrape/refresh every minute:
  Argyle and the source platform determine the underlying data schedule.
- All pagination remains fixed to the same API host, path and verified owner.
  At most 1,000 gigs and 400 accounts are read per request. Partial results are
  marked; the view shows up to 50 recent completed deliveries from the rolling
  30-day window. Currency groups are separate, missing pay stays unknown, and
  duplicates, non-delivery work, unaccepted offers and cancelled/in-progress work
  cannot inflate completed earnings. Gig mileage is not total shift mileage.
- Argyle stores the connected source data. MileCount stores only the user ID
  mapping and consent/lock metadata; normalized earnings exist in request/browser
  memory only. No raw addresses, identity, tax forms or bank data are returned.
- Disconnect explicitly deletes that account and its associated shared data from
  this Argyle client. It does not delete the original driver account or bookings.
- No incoming-offer feed, automatic acceptance, cross-platform stacking approval,
  production provider coverage, or optimizer input is implied by account linking.
  Existing manual and demo planning remain separate and unchanged.

## Verification

Run `npm test` and `npm run test:browser`. The integration suites mock provider
responses to check ownership, consent, sandbox isolation, error handling,
pagination, totals, revocation and mobile UI. These tests do not establish
production API approval or real driver-account connectivity.

Official contracts reviewed 2026-10-03:

- https://docs.argyle.com/link/initialization/web
- https://docs.argyle.com/api-reference/users/create-a-user
- https://docs.argyle.com/api-reference/user-tokens/create-a-user-token
- https://docs.argyle.com/api-reference/accounts
- https://docs.argyle.com/api-reference/accounts/delete-an-account
- https://docs.argyle.com/api-reference/gigs/list-all-gigs
- https://docs.argyle.com/api-reference/items
- https://docs.argyle.com/overview/ongoing-refresh
