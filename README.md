# VIC Energy Check

Live Victorian residential electricity bill comparator. Checks a customer's usage
against 135 current retail plans from 15 retailers (pulled from each retailer's
Consumer Data Right feed) and ranks the cheapest matches.

## Stack

- **Next.js** (App Router) — the website/app itself, deployed on **Vercel**.
- **Supabase** — stores lead signups (`supabase/schema.sql` has the table + Row
  Level Security policies: the public site can only *insert* new leads, never
  read anyone else's).
- Plan data lives in `lib/plans.ts`, generated from a live CDR pull. Refreshing
  it means re-running the pull and regenerating that file — see the project's
  architecture notes for the pipeline.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the two Supabase values
npm run dev
```

## Deploying

1. Push this repo to GitHub.
2. In Supabase: paste `supabase/schema.sql` into SQL Editor and run it once.
3. In Vercel: New Project > Import this repo > add the two env vars from
   `.env.local.example` (Project Settings > Environment Variables) > Deploy.
