-- Review migration; do not infer paid entitlements from profiles.plan or email.
begin;
create or replace function public.milecount_entitlements()
returns jsonb language sql stable security definer set search_path=public as $$
 select case when public.is_milecount_admin() then
 jsonb_build_object('admin',true,'active',true,'plan','platinum','maxTrucks',2147483647,'commercialRouting',true)
 else coalesce((select jsonb_build_object('admin',false,'active',true,'plan',s.plan,
 'maxTrucks',case when s.plan='platinum' then 5 else 1 end,
 'commercialRouting',s.plan in ('premium','platinum'))
 from public.subscriptions s where s.user_id=auth.uid()
 and s.status in ('active','trialing') and s.plan in ('basic','gold','premium','platinum')
 and s.current_period_end>now() order by s.current_period_end desc limit 1),
 jsonb_build_object('admin',false,'active',false,'plan','basic','maxTrucks',1,'commercialRouting',false)) end
$$;
revoke all on function public.milecount_entitlements() from public,anon;
grant execute on function public.milecount_entitlements() to authenticated;
create table public.truck_brain_states(
 user_id uuid not null references auth.users(id) on delete cascade,
 vehicle_key text not null check(length(vehicle_key) between 1 and 100),
 version bigint not null default 0 check(version>=0),
 state jsonb not null default '{}'::jsonb check(jsonb_typeof(state)='object'),
 updated_at timestamptz not null default now(),
 primary key(user_id,vehicle_key)
);
alter table public.truck_brain_states enable row level security;
create policy brain_read on public.truck_brain_states for select to authenticated using(user_id=auth.uid());
revoke all on public.truck_brain_states from public,authenticated,anon;
grant select on public.truck_brain_states to authenticated;
create or replace function public.save_truck_brain(p_vehicle_key text,p_expected_version bigint,p_state jsonb)
returns bigint language plpgsql security definer set search_path=public as $$
declare v bigint; lim integer;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_state is null or jsonb_typeof(p_state)<>'object' or p_vehicle_key is null or length(p_vehicle_key) not between 1 and 100 or p_expected_version is null or p_expected_version<0 then raise exception 'Invalid truck state';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 lim=(public.milecount_entitlements()->>'maxTrucks')::integer;
 if not exists(select 1 from public.truck_brain_states where user_id=auth.uid() and vehicle_key=p_vehicle_key)
 and (select count(*) from public.truck_brain_states where user_id=auth.uid())>=lim then raise exception 'Plan truck limit reached';end if;
 insert into public.truck_brain_states(user_id,vehicle_key) values(auth.uid(),p_vehicle_key) on conflict do nothing;
 select version into v from public.truck_brain_states where user_id=auth.uid() and vehicle_key=p_vehicle_key for update;
 if v<>p_expected_version then raise exception 'Truck state changed on another device; reload before saving';end if;
 update public.truck_brain_states set version=v+1,state=p_state,updated_at=now() where user_id=auth.uid() and vehicle_key=p_vehicle_key;
 return v+1;
end$$;
revoke all on function public.save_truck_brain(text,bigint,jsonb) from public,anon;
grant execute on function public.save_truck_brain(text,bigint,jsonb) to authenticated;
-- Serialize additions per owner; two concurrent inserts cannot exceed the limit.
create or replace function public.enforce_milecount_vehicle_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare lim integer;begin
 if auth.uid() is null then return new;end if; -- service-role provisioning is separately authorized
 if new.user_id<>auth.uid() then raise exception 'Vehicle owner mismatch';end if;
 if public.is_milecount_admin() then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 lim=(public.milecount_entitlements()->>'maxTrucks')::integer;
 if (select count(*) from public.vehicles where user_id=new.user_id)>=lim then raise exception 'Plan truck limit reached';end if;
 return new;
end$$;
create trigger milecount_vehicle_limit before insert on public.vehicles for each row execute function public.enforce_milecount_vehicle_limit();
revoke all on function public.enforce_milecount_vehicle_limit() from public,anon,authenticated;
-- Server-only quota reservation. Limits are operational configuration, not prices.
create table public.commercial_route_usage(user_id uuid not null references auth.users(id) on delete cascade,bucket timestamptz not null,units integer not null default 0,primary key(user_id,bucket));
alter table public.commercial_route_usage enable row level security;
revoke all on public.commercial_route_usage from public,anon,authenticated;
create or replace function public.reserve_commercial_route(p_user uuid,p_units integer,p_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare used integer; b timestamptz=date_trunc('hour',now());begin
 if p_user is null or p_units is null or p_limit is null or p_units<1 or p_limit<1 then raise exception 'Invalid quota';end if;
 insert into public.commercial_route_usage(user_id,bucket) values(p_user,b) on conflict do nothing;
 select units into used from public.commercial_route_usage where user_id=p_user and bucket=b for update;
 if used+p_units>p_limit then return false;end if;
 update public.commercial_route_usage set units=used+p_units where user_id=p_user and bucket=b;return true;
end$$;
revoke all on function public.reserve_commercial_route(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_commercial_route(uuid,integer,integer) to service_role;

commit;
