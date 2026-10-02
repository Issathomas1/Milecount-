-- PayPal is a server-only billing writer. Never trust browser approval callbacks.
begin;
create table public.paypal_checkouts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 environment text not null check(environment in ('sandbox','live')),
 plan text not null check(plan in ('basic','gold','premium','platinum')),
 plan_id text not null,
 subscription_id text unique,
 current boolean not null default true,
 provider_status text not null default 'CREATING',
 sync_version bigint not null default 0,
 payment_id text,
 paid_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index paypal_one_current_checkout on public.paypal_checkouts(user_id,environment) where current;
create table public.paypal_request_usage (
 user_id uuid not null references auth.users(id),bucket timestamptz not null,units integer not null default 0,primary key(user_id,bucket)
);
alter table public.paypal_request_usage enable row level security;
revoke all on public.paypal_request_usage from public,anon,authenticated;
grant all on public.paypal_request_usage to service_role;
create function public.reserve_paypal_request(p_user uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; b timestamptz=date_trunc('hour',now());begin
 insert into public.paypal_request_usage(user_id,bucket,units) values(p_user,b,1)
 on conflict(user_id,bucket) do update set units=paypal_request_usage.units+1 returning units into n;
 return n<=60;
end $$;
revoke all on function public.reserve_paypal_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_paypal_request(uuid) to service_role;
create table public.paypal_revoked_payments (
 environment text not null check(environment in ('sandbox','live')),
 payment_id text not null,
 event_id text not null,
 created_at timestamptz not null default now(),
 primary key(environment,payment_id)
);
alter table public.paypal_checkouts enable row level security;
alter table public.paypal_revoked_payments enable row level security;
revoke all on public.paypal_checkouts,public.paypal_revoked_payments from public,anon,authenticated;
grant all on public.paypal_checkouts,public.paypal_revoked_payments to service_role;

create function public.reserve_paypal_checkout(p_user uuid,p_environment text,p_plan text,p_plan_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.paypal_checkouts; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,71));
 select * into c from public.paypal_checkouts where user_id=p_user and environment=p_environment and current for update;
 if c.id is not null then
  if c.provider_status in ('CANCELLED','EXPIRED') and coalesce(c.paid_until,now())<=now() then
   update public.paypal_checkouts set current=false where id=c.id;
  else
   if c.plan<>p_plan or c.plan_id<>p_plan_id then raise exception 'An existing subscription must be managed before changing plans';end if;
   return to_jsonb(c);
  end if;
 end if;
 if p_environment='live' and exists(select 1 from public.subscriptions where user_id=p_user and status in ('active','trialing') and current_period_end>now()) then
  raise exception 'An active subscription already exists';
 end if;
 insert into public.paypal_checkouts(user_id,environment,plan,plan_id) values(p_user,p_environment,p_plan,p_plan_id) returning * into c;
 return to_jsonb(c);
end $$;

create function public.attach_paypal_subscription(p_checkout uuid,p_subscription text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.paypal_checkouts set subscription_id=p_subscription,provider_status='APPROVAL_PENDING',updated_at=now()
 where id=p_checkout and (subscription_id is null or subscription_id=p_subscription);
 if not found then raise exception 'Subscription association conflict';end if;
end $$;

create function public.begin_paypal_sync(p_checkout uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v bigint;begin
 update public.paypal_checkouts set sync_version=sync_version+1 where id=p_checkout returning sync_version into v;
 return v;
end $$;

create function public.apply_paypal_sync(p_checkout uuid,p_version bigint,p_status text,p_payment text,p_paid_until timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare c public.paypal_checkouts; paid timestamptz;begin
 select * into c from public.paypal_checkouts where id=p_checkout for update;
 if c.id is null or c.sync_version<>p_version then return false;end if;
 paid=p_paid_until;
 if exists(select 1 from public.paypal_revoked_payments where environment=c.environment and payment_id=p_payment) then paid=null;end if;
 update public.paypal_checkouts set provider_status=p_status,payment_id=p_payment,paid_until=paid,updated_at=now() where id=c.id;
 -- Sandbox can never activate a live account. Retired subscriptions cannot replace a newer checkout.
 if c.environment='live' and c.current then
  perform set_config('milecount.billing_writer','paypal',true);
  insert into public.subscriptions(user_id,provider,provider_subscription_id,plan,status,current_period_end,updated_at)
  values(c.user_id,'paypal',c.subscription_id,c.plan,case when paid>now() then 'active' else 'inactive' end,paid,now())
  on conflict(user_id) do update set provider='paypal',provider_subscription_id=excluded.provider_subscription_id,
    plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,updated_at=now();
 end if;
 return true;
end $$;

create function public.revoke_paypal_payment(p_environment text,p_payment text,p_event text)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.paypal_revoked_payments(environment,payment_id,event_id) values(p_environment,p_payment,p_event) on conflict do nothing;
 -- Increment the revision so an in-flight older read cannot restore refunded access.
 update public.paypal_checkouts set paid_until=null,sync_version=sync_version+1,updated_at=now() where environment=p_environment and payment_id=p_payment;
 if p_environment='live' then
  perform set_config('milecount.billing_writer','paypal',true);
  update public.subscriptions s set status='inactive',current_period_end=null,updated_at=now()
  from public.paypal_checkouts c where c.current and c.environment='live' and c.payment_id=p_payment
   and s.user_id=c.user_id and s.provider='paypal' and s.provider_subscription_id=c.subscription_id;
 end if;
end $$;

-- Prevent the old Stripe webhook from overwriting PayPal entitlements.
create function public.protect_paypal_subscription() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.provider='paypal' or old.provider='paypal') and coalesce(current_setting('milecount.billing_writer',true),'')<>'paypal' then
  raise exception 'PayPal entitlements must use the verified billing writer';
 end if;
 return new;
end $$;
create trigger protect_paypal_subscription before insert or update on public.subscriptions for each row execute function public.protect_paypal_subscription();
revoke all on function public.protect_paypal_subscription() from public,anon,authenticated;
revoke all on function public.reserve_paypal_checkout(uuid,text,text,text),public.attach_paypal_subscription(uuid,text),public.begin_paypal_sync(uuid),public.apply_paypal_sync(uuid,bigint,text,text,timestamptz),public.revoke_paypal_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_paypal_checkout(uuid,text,text,text),public.attach_paypal_subscription(uuid,text),public.begin_paypal_sync(uuid),public.apply_paypal_sync(uuid,bigint,text,text,timestamptz),public.revoke_paypal_payment(text,text,text) to service_role;
commit;
