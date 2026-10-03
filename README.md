# VIC Energy Check

Live Victorian residential electricity bill comparator. Checks a customer's usage
against 135 current retail plans from 15 retailers (pulled from each retailer's
Consumer Data Right feed) and ranks the cheapest matches.

## Stack

- **Next.js** (App Router) — the website/app itself, deployed on **Vercel**.
- **Supabase** — stores lead signups (`supabase/schema.sql` has the table + Row
  Level Security policies: the public site can only *insert* new leads, never
  read anyone else's).
- **Recharts** — the bill-vs-plans chart on the comparator, and the charts on
  `/dashboard`.
- Plan data lives in `lib/plans.ts`, generated from a live CDR pull. Refreshing
  it means re-running the pull and regenerating that file — see the project's
  architecture notes for the pipeline.

## Photo bill reading

Customers can take/upload a photo of their bill instead of typing in their
usage. The photo is resized in the browser, sent to `app/api/extract-bill`,
read by Claude's vision API (Anthropic), and the extracted numbers autofill
the existing form — the form itself is the "check this looks right" step,
nothing is calculated or saved until the customer reviews it. The photo
itself is never stored, only the numbers read off it. Needs `ANTHROPIC_API_KEY`
(server-only) — without it, this feature quietly stays off and manual entry
still works.

## Subscriptions (paid "ongoing monitoring & alerts")

The free comparator above always stays free with no sign-up. On top of it,
customers can pay — monthly, quarterly, half-yearly, or a once-off payment —
for ongoing monitoring: the promise is that VIC Energy Check keeps watching
the market and alerts them when something cheaper appears, rather than them
having to re-check manually.

**Important — read before taking real payments:** this build only covers
*payment collection and record-keeping* (Stripe Checkout + a `subscribers`
table). It does **not** yet include the actual recurring job that re-checks
prices and sends alert emails — that's a separate follow-up build (it needs
an email-sending service like Resend/SendGrid/Postmark, and a scheduled job).
Don't advertise or charge for this publicly until that's built, unless you
have your own manual process for checking in on subscribers in the meantime.

- Prices live in `lib/pricingPlans.ts` ($6.99 monthly / $17.99 quarterly /
  $32.99 half-yearly / $59.00 once-off, confirmed by Phil) — change them
  there any time.
- Checkout is Stripe Checkout (hosted payment page); card details never touch
  this app's own servers.
- **Use a separate Stripe account for this business.** Stripe accounts are
  tied to one registered business; mixing VIC Energy Check's payments into
  an existing account for an unrelated business (e.g. a different ABN/trading
  name) causes mismatched statement descriptors and MCC codes, muddies your
  own bookkeeping and tax reporting, and can trip Stripe's own compliance
  checks. Signing up for a new Stripe account is free and only takes a few
  minutes at stripe.com.
- Needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see
  `.env.local.example`) and the new `subscribers` table from
  `supabase/schema.sql`. Without them, the pricing cards show but checkout
  quietly reports "payments aren't switched on yet" — nothing breaks.

## `/dashboard` — private analytics

A password-protected page (not linked from the public site) showing leads over
time, leads by network, average savings found, a table of recent signups, and
— once someone has paid — active subscriber counts, amount collected at
checkout, and a table of recent subscribers. Protected by `middleware.ts`,
which checks a `DASHBOARD_PASSWORD` you set yourself — it's unrelated to your
Supabase password. It reads the `leads` and `subscribers` tables with the
Supabase *secret* key (`lib/supabaseAdmin.ts`, server-only, bypasses Row
Level Security), so that key must be set in Vercel too.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the Supabase values + a dashboard password
npm run dev
```

## Deploying

1. Push this repo to GitHub.
2. In Supabase: paste `supabase/schema.sql` into SQL Editor and run it once
   (safe to re-run — it only creates the `subscribers` table if it's missing).
3. In Vercel: New Project > Import this repo > add the env vars from
   `.env.local.example` (Project Settings > Environment Variables) > Deploy.
4. **Only if you're switching on paid subscriptions:** in Stripe (on the
   account dedicated to this business — see "Subscriptions" above), add a
   webhook endpoint at `https://<your-site>/api/stripe-webhook` listening for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`, copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` in Vercel, and copy your Stripe secret key into
   `STRIPE_SECRET_KEY`. Redeploy after adding them.
