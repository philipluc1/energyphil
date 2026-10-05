-- VIC Energy Check — lead capture schema
-- Paste this whole file into Supabase Dashboard > SQL Editor > New query > Run.
-- Safe to run once on a fresh project.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  distributor text not null,
  billing_days integer not null,
  usage_mode text not null,              -- 'simple' | 'detailed'
  peak_kwh numeric,
  shoulder_kwh numeric,
  offpeak_kwh numeric,
  anytime_kwh numeric,
  controlled_load_kwh numeric,
  current_bill numeric,                  -- null if the customer left it blank (used VDO benchmark instead)
  best_retailer text,
  best_plan_name text,
  best_total numeric,
  estimated_saving numeric,
  estimated_saving_pct numeric
);

-- Row Level Security: the public site must only be able to INSERT new leads —
-- never read, edit, or delete anyone else's. Only you, signed in to the
-- Supabase dashboard, can browse the leads table (Table Editor > leads).
alter table public.leads enable row level security;

-- Policy scoped "to public" (every Postgres role, not just "anon") so this
-- works no matter which role Supabase's API gateway resolves an unauthenticated
-- request to under the newer publishable-key system. It still only grants
-- INSERT — there is no select/update/delete policy, so those stay denied.
drop policy if exists "anon can submit a lead" on public.leads;
drop policy if exists "public can submit a lead" on public.leads;
create policy "public can submit a lead"
  on public.leads
  for insert
  to public
  with check (true);

-- Belt-and-suspenders: make sure the table-level grants exist too (RLS
-- policies only apply once the role already has the underlying privilege).
grant usage on schema public to anon, authenticated;
grant insert on public.leads to anon, authenticated;

-- Paying subscribers (monthly / quarterly / half-yearly / once-off). Written
-- only by the server — the Stripe webhook, using the secret key, which
-- bypasses Row Level Security entirely. RLS is enabled with NO policies for
-- anon/authenticated, so this table is locked down from the public site by
-- default (the public site never reads or writes it directly); the private
-- /dashboard reads it the same way it reads leads.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  plan text not null,                    -- 'monthly' | 'quarterly' | 'half_yearly' | 'once_off'
  status text not null default 'active', -- 'active' | 'canceled' | 'past_due'
  amount_cents integer not null,
  currency text not null default 'aud',
  stripe_customer_id text,
  stripe_subscription_id text,           -- null for once_off
  stripe_checkout_session_id text,
  current_period_end timestamptz,        -- null for once_off (no renewal)
  -- The comparison they subscribed from, so the monitoring job (future work)
  -- knows what to re-check and compare against.
  distributor text,
  billing_days integer,
  usage_mode text,
  peak_kwh numeric,
  shoulder_kwh numeric,
  offpeak_kwh numeric,
  anytime_kwh numeric,
  controlled_load_kwh numeric,
  baseline_total numeric,
  baseline_retailer text,
  baseline_plan_name text
);

alter table public.subscribers enable row level security;
-- Intentionally no policies here — the public site has no reason to ever
-- select/insert/update this table directly, so every role stays denied by
-- default and only the secret-key server connection can touch it.

-- Price-watch columns — power the automatic recheck job (app/api/cron/recheck-prices)
-- that re-prices each saved profile and emails people when something cheaper shows
-- up. Safe to re-run: each line only adds a column if it isn't already there, so
-- running this whole file again after upgrading is fine.
alter table public.leads add column if not exists wants_price_alerts boolean not null default false;
alter table public.leads add column if not exists unsubscribed boolean not null default false;
alter table public.leads add column if not exists last_notified_total numeric;
alter table public.leads add column if not exists last_notified_retailer text;
alter table public.leads add column if not exists last_notified_plan_name text;
alter table public.leads add column if not exists last_notified_at timestamptz;

alter table public.subscribers add column if not exists unsubscribed boolean not null default false;
alter table public.subscribers add column if not exists last_notified_total numeric;
alter table public.subscribers add column if not exists last_notified_retailer text;
alter table public.subscribers add column if not exists last_notified_plan_name text;
alter table public.subscribers add column if not exists last_notified_at timestamptz;

-- Customer accounts ("what plan am I on?") — sign-in is passwordless (Supabase
-- Auth magic-link email), so there's no separate "sign up" step: entering an
-- email on /account creates the account the first time and signs it in every
-- time after. This policy is what lets a signed-in customer's browser read
-- their OWN row straight out of this table — matched by email, nothing else
-- is exposed, and anonymous (not-signed-in) requests still can't read any of
-- it, same as before.
grant select on public.subscribers to authenticated;
drop policy if exists "subscriber can view own record" on public.subscribers;
create policy "subscriber can view own record"
  on public.subscribers
  for select
  to authenticated
  using ((select auth.email()) = email);

-- The customer's REAL starting point for "how much have you saved" math —
-- what they were actually paying (their entered bill, or the VDO benchmark
-- if they left it blank) at the moment they subscribed. Kept separate from
-- baseline_total above, which is the price of the plan we recommended to
-- them and is only used by the recheck job to spot something EVEN cheaper
-- later — baseline_total was never a record of what they used to pay.
alter table public.subscribers add column if not exists reference_total numeric;

-- Savings history. One row per "this was the cheapest plan we had this
-- customer matched to, from this date until the next row starts" — written
-- once at signup, and again every time the daily recheck job finds something
-- cheaper (see app/api/cron/recheck-prices). Accumulated savings is then
-- just: for each row, (days it was the current match) × (its daily saving
-- rate vs reference_total), added up. This is an ESTIMATE shown to the
-- customer as such — it assumes they switched to and stayed on whatever we
-- last matched them to; we have no way to confirm they actually did.
create table if not exists public.savings_episodes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  email text not null,                  -- denormalized for a simple RLS match, same pattern as subscribers
  started_at timestamptz not null default now(),
  ended_at timestamptz,                 -- null = this is the current, still-running episode
  daily_rate numeric not null,          -- (reference_total - best_total) / billing_days, for this episode
  best_retailer text,
  best_plan_name text,
  best_total numeric
);

alter table public.savings_episodes enable row level security;
grant select on public.savings_episodes to authenticated;
drop policy if exists "subscriber can view own savings episodes" on public.savings_episodes;
create policy "subscriber can view own savings episodes"
  on public.savings_episodes
  for select
  to authenticated
  using ((select auth.email()) = email);
-- No insert/update/delete policy — same locked-down-by-default pattern as
-- subscribers; only the server's secret-key connection (checkout webhook,
-- recheck cron) ever writes these rows.

-- Customer identity + property details — name/address so the sign-up and the
-- bill-photo shortcut can pre-fill who this is for, and solar/postcode so the
-- comparison and the portal can reflect a solar household correctly. Entirely
-- optional on both tables: nothing here is required to get a free comparison,
-- only collected when the customer (or their bill) actually supplies it. Same
-- "add column if not exists" pattern as above — safe to re-run.
alter table public.leads add column if not exists customer_name text;
alter table public.leads add column if not exists address text;
alter table public.leads add column if not exists suburb text;
alter table public.leads add column if not exists postcode text;
alter table public.leads add column if not exists has_solar boolean not null default false;
alter table public.leads add column if not exists solar_export_kwh numeric;

alter table public.subscribers add column if not exists customer_name text;
alter table public.subscribers add column if not exists address text;
alter table public.subscribers add column if not exists suburb text;
alter table public.subscribers add column if not exists postcode text;
alter table public.subscribers add column if not exists has_solar boolean not null default false;
alter table public.subscribers add column if not exists solar_export_kwh numeric;

-- Household profile (people, dwelling, heating, EV, solar size, ...) captured
-- on /check, so usage can be estimated for their shape rather than a general average.
alter table public.leads add column if not exists home_profile jsonb;
alter table public.subscribers add column if not exists home_profile jsonb;

-- One row per member per month per source: the saving found by that month's
-- check. 'auto' = the monthly recheck job re-pricing their saved profile,
-- 'manual' = they ran /check and saved it, 'bill' = saved after reading a bill.
-- The My Dashboard chart prefers these over the running estimate.
create table if not exists public.bill_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  month date not null,                  -- first day of the month checked
  source text not null,                 -- 'auto' | 'manual' | 'bill'
  billing_days integer not null,
  reference_total numeric not null,     -- what they pay now (or the VDO benchmark)
  best_total numeric not null,
  best_retailer text,
  best_plan_name text,
  saving numeric not null,              -- reference_total - best_total for billing_days
  unique (email, month, source)
);
alter table public.bill_checks enable row level security;
grant select on public.bill_checks to authenticated;
drop policy if exists "member can view own checks" on public.bill_checks;
create policy "member can view own checks"
  on public.bill_checks for select to authenticated
  using ((select auth.email()) = email);
-- Writes happen only on the server (secret key).

-- Bill photo/PDF reads, counted per member per day to cap AI cost.
create table if not exists public.bill_reads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null
);
alter table public.bill_reads enable row level security;
create index if not exists bill_reads_email_created on public.bill_reads (email, created_at desc);
