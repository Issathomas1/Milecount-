-- Service-only ownership mapping. Never store driver passwords or Link tokens.
create table public.argyle_user_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check (environment in ('sandbox','production')),
  argyle_user_id uuid,
  consent_version text,
  consented_at timestamptz,
  lock_id uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, environment),
  unique (environment, argyle_user_id)
);
alter table public.argyle_user_connections enable row level security;
revoke all on public.argyle_user_connections from public, anon, authenticated;
grant select, insert, update, delete on public.argyle_user_connections to service_role;
comment on table public.argyle_user_connections is 'Service-only Argyle ownership mapping. Browser access is intentionally denied; the Edge Function verifies the user and scopes every query.';
