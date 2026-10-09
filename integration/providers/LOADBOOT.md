# LoadBoot production integration

Production read access approved October 8, 2026 for MileCount / Edit All Futures LLC.

- Provider API: `https://rwscphuhpjoudvljvmdk.supabase.co/functions/v1/dev-api`
- Authentication: Bearer read key, stored in Supabase Vault as `milecount_loadboot_production`. No key is committed or returned to clients.
- Backend: existing `loadboot-sandbox` endpoint retains sandbox default; `?mode=production` explicitly selects production.
- The SECURITY INVOKER credential RPC is executable only by service_role. Anonymous and signed-in browser roles cannot execute it or read Vault.
- Frontend: `loadboot.js`; live search, state board, local day and dispatch inventory include production opportunities.
- Provider filter distinguishes LoadBoot from LoadBoot Sandbox. TEST/SIM data stays separate.
- Every load link uses `https://loadboot.com/app/carrier/?src=milecount-edit-all-futures-llc&ref={ref}` with URL-encoded ref and visible `via LoadBoot` attribution.
- API returns at most 50 newest loads per state query. No unsupported pagination or whole-market count is claimed.
- Read-only integration. Carrier booking continues on LoadBoot; no booking confirmation, write scope or private webhooks are implied.
- Server/client polling cache: five minutes. Expired loads are dropped; failed refresh returns an error rather than stale freight. Client rejects observations older than fifteen minutes and sandbox responses on the production path.
- Documentation rate limit: 60 requests/minute/key; upstream 429 is respected.

Verification on October 9, 2026 UTC: authenticated production requests succeeded, with zero available loads returned both nationwide and for Georgia. Empty inventory is not represented as an integration failure or filled with simulated loads. Fixture tests exercise nonempty responses separately.
