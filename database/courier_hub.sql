create table if not exists public.courier_opportunities (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100),
 pickup text not null check (char_length(pickup) between 1 and 120),
 dropoff text not null check (char_length(dropoff) between 1 and 120),
 pay numeric(12,2) not null default 0 check (pay >= 0),
 miles numeric(10,1) not null default 0 check (miles >= 0),
 status text not null default 'lead' check (status in ('lead','quoted','accepted','completed')),
 notes text not null default '' check (char_length(notes) <= 300),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists courier_opportunities_user_created_idx on public.courier_opportunities(user_id, created_at desc);
alter table public.courier_opportunities enable row level security;
drop policy if exists "Users manage own courier opportunities" on public.courier_opportunities;
create policy "Users manage own courier opportunities" on public.courier_opportunities for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.courier_earnings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 100),
 gross numeric(12,2) not null default 0 check (gross >= 0),
 expenses numeric(12,2) not null default 0 check (expenses >= 0),
 miles numeric(10,1) not null default 0 check (miles >= 0),
 date date not null,
 created_at timestamptz not null default now()
);
create index if not exists courier_earnings_user_date_idx on public.courier_earnings(user_id, date desc, created_at desc);
alter table public.courier_earnings enable row level security;
drop policy if exists "Users manage own courier earnings" on public.courier_earnings;
create policy "Users manage own courier earnings" on public.courier_earnings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.courier_opportunities, public.courier_earnings from anon, public;
grant select, insert, update, delete on table public.courier_opportunities, public.courier_earnings to authenticated;
