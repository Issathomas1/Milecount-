-- Security hardening: partner/admin RPCs are only intended for signed-in users.
-- Each function still performs its own authorization checks for admin-only actions.
revoke execute on function public.admin_partner_requests() from public, anon;
revoke execute on function public.admin_set_partner_status(uuid, text) from public, anon;
revoke execute on function public.is_milecount_admin() from public, anon;
revoke execute on function public.request_partner_access(text, text) from public, anon;
grant execute on function public.admin_partner_requests() to authenticated;
grant execute on function public.admin_set_partner_status(uuid, text) to authenticated;
grant execute on function public.is_milecount_admin() to authenticated;
grant execute on function public.request_partner_access(text, text) to authenticated;
