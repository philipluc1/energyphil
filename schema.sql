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

-- Row Level Security: the public site uses the anon key, which must only be able to
-- INSERT new leads — never read, edit, or delete anyone else's. Only you, signed in to
-- the Supabase dashboard, can browse the leads table (Table Editor > leads).
alter table public.leads enable row level security;

drop policy if exists "anon can submit a lead" on public.leads;
create policy "anon can submit a lead"
  on public.leads
  for insert
  to anon
  with check (true);

-- No select/update/delete policy is created for anon, so those stay denied by default.
