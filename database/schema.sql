-- MileCount Cloud V1 PostgreSQL schema
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text,
  display_name text,
  home_city text default 'Atlanta, GA',
  plan text not null default 'free' check (plan in ('free','pro','fleet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  vehicle_type text not null,
  mpg numeric not null,
  cargo_length_ft numeric,
  payload_lb integer,
  monthly_payment numeric default 0,
  monthly_insurance numeric default 0,
  maintenance_cpm numeric default 0,
  monthly_other numeric default 0,
  expected_monthly_miles integer default 8000,
  is_default boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  origin text not null,
  destination text not null,
  home_city text,
  primary_pay numeric default 0,
  added_pay numeric default 0,
  return_pay numeric default 0,
  road_miles numeric default 0,
  fuel_cost numeric default 0,
  all_miles_rpm numeric default 0,
  estimated_margin numeric default 0,
  status text default 'analyzed',
  created_at timestamptz not null default now()
);

create table if not exists analyzed_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  external_ref text,
  source text default 'manual',
  pickup_city text not null,
  delivery_city text not null,
  pay numeric not null,
  weight_lb integer default 0,
  space_ft numeric default 0,
  detour_miles numeric default 0,
  incremental_fuel numeric default 0,
  recommendation text,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  provider text default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  status text default 'inactive',
  plan text default 'free',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_user_idx on vehicles(user_id);
create index if not exists trips_user_created_idx on trips(user_id, created_at desc);
create index if not exists loads_user_created_idx on analyzed_loads(user_id, created_at desc);
