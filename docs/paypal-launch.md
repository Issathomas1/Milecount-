# PayPal Basic integration — staged, not launched

The live PayPal plan was verified in the merchant dashboard on October 2, 2026:

- Product: MileCount (`milecount-software`)
- Plan: MileCount Basic, `P-69L05151FD3776706NK74IGI`
- $19 USD every month, unlimited cycles, no trial or setup fee
- Dashboard currently says no tax, pause after one missed billing cycle, and automatic billing of outstanding payments **on**.
- Its live Default App client ID matches the public SDK snippet supplied by the owner.
- Webhook credential and return/cancel URLs were not yet attached when inspected.

No secret belongs in this repository, the browser, a screenshot, or chat.

## Architecture

The browser asks the signed-in billing endpoint to create a subscription. A server-owned checkout UUID is sent as PayPal `custom_id`; the plan and price are allowlisted on the server. Repeated clicks reuse that checkout and its PayPal request ID. The browser's approval callback only requests a status check. It never writes entitlements.

The endpoint verifies the account through Supabase Auth, fetches subscription details and settled transactions from PayPal, and updates the existing authoritative `subscriptions` table through service-only functions. A webhook verifies PayPal's signature before processing any event. Delayed events trigger a fresh provider read; database revisions reject older concurrent reads. Refund/reversal facts are retained so stale provider snapshots cannot restore refunded access. Test checkouts have a separate environment and never update live subscriptions. Owner access still comes from the existing server admin function.

Cancellation stops future billing, preserving the remaining paid month unless payment is refunded/reversed. Paid access expires using `current_period_end` even if notifications stop. Failed provider requests preserve the prior verified state. Uncertain creation older than one hour stops for reconciliation rather than risking a second charge. Automatic upgrades/downgrades are not enabled.

## Configuration and rollout gates

1. Apply the migration and deploy `paypal-billing` with gateway JWT verification disabled: the handler performs explicit user-token and webhook-signature verification. Leave checkout disabled.
2. Store these in Supabase Edge Function secrets, never frontend environment variables:
   - `PAYPAL_ENVIRONMENT=live`
   - `PAYPAL_CLIENT_ID` from the existing live Default App
   - `PAYPAL_CLIENT_SECRET` from that same app
   - `PAYPAL_WEBHOOK_ID` from the matching app/environment
   - `PAYPAL_CHECKOUT_ENABLED=false` until all launch checks pass
3. Add `https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/paypal-billing/webhook` to that app for `BILLING.SUBSCRIPTION.CREATED`, `ACTIVATED`, `UPDATED`, `CANCELLED`, `SUSPENDED`, `EXPIRED`, `PAYMENT.FAILED`, and `PAYMENT.SALE.COMPLETED`, `DENIED`, `REFUNDED`, `REVERSED` (the full `BILLING.SUBSCRIPTION.` prefix applies to those subscription suffixes). Attach the same app to the Basic plan's webhook credential field. Use the live dashboard's supported event list.
4. Test the corresponding sandbox app/plan in a separate function deployment with `PAYPAL_ENVIRONMENT=sandbox`, its own client/secret/webhook, `PAYPAL_SANDBOX_BASIC_PLAN_ID`, and optional `PAYPAL_PREVIEW_ORIGIN`. Never reuse a live plan ID in sandbox. Run actual approval, settled payment, renewal, failure, cancellation, refund and return-page recovery tests. Automated fixtures do not replace this gate.
5. Review tax requirements and cancellation/refund disclosures before activation. Current price validation intentionally rejects a tax-bearing plan until the display is reviewed.
6. Resolve the pre-existing free Basic fallback: `app.js` currently gives basic planning limits to accounts without an active entitlement. Decide/enforce the intended free preview versus paid Basic boundary across protected services before accepting paid users. This billing change does not silently change existing drivers' planning access.
7. Retire or fix the old Stripe webhook writer. The migration prevents it from overwriting a PayPal subscription, but its legacy `pro` plan mapping is still a separate migration concern.
8. Run a live configuration read/plan check and review the mobile flow. Only then set `PAYPAL_CHECKOUT_ENABLED=true`, merge the frontend and verify the Cloudflare build. Other tiers stay unavailable until their own plans and feature promises are validated.

## Validation

`node tests/paypal-billing.cjs` uses the real migration in PGlite plus mocked PayPal HTTP responses: authentication, ownership, settled-payment-only activation, price/plan rejection, repeat checkout, cancellation, refund signature verification, duplicate/stale events, sandbox separation, RLS and old-writer protection.

`node tests/paypal-checkout.cjs` uses Chromium at 390px: configured-off state, callback without paid confirmation, server-confirmed success, retry without new checkout, owner bypass and overflow checks. No real money is used.

Official references: [PayPal subscriptions](https://developer.paypal.com/api/subscriptions/v1), [signature verification](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth).
