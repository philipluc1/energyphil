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
