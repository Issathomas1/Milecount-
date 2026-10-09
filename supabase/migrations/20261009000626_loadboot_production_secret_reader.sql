-- Key inserted separately into encrypted Vault; never include credential values here.
create or replace function public.milecount_loadboot_production_token()
returns text language sql stable security invoker set search_path = '' as $$
 select decrypted_secret from vault.decrypted_secrets
 where name = 'milecount_loadboot_production' limit 1
$$;
revoke all on function public.milecount_loadboot_production_token() from public, anon, authenticated;
grant execute on function public.milecount_loadboot_production_token() to service_role;
