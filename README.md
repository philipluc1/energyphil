# VIC Energy Check

Live Victorian residential electricity bill comparator. Checks a customer's usage
against 135 current retail plans from 15 retailers (pulled from each retailer's
Consumer Data Right feed) and ranks the cheapest matches.

## Pages

- `/` — the home page: what the service does, how it works, independence/privacy
  reassurance, and a teaser of the paid monitoring plans. Links through to `/check`.
- `/check` — the actual tool: a 4-step wizard (address → billing period → usage →
  solar) that sets your network from your postcode (always overridable), then shows
  ranked results including solar feed-in credit and controlled load. Upload/photo a
  bill to autofill any step, or just type it in. Ends with (optionally) subscribing
  to ongoing monitoring or leaving your email for a one-off copy.
- `/account` — customer self-service: sign in (passwordless — see "Customer accounts"
  below), see which plan you're on and its full rate breakdown ("your tariff"),
  savings history, written energy-saving tips, and manage/cancel billing.
- `/default-offer` — evergreen explainer: what the Victorian Default Offer (VDO) is,
  why market offers change constantly, and the current VDO reference rates by
  network (pulled from the same `lib/plans.ts` data as everything else).
- `/privacy` — Privacy Policy.
- `/cancellation-policy` — Cancellation Policy: cancel anytime, keep full benefit
  through the already-paid period, no prorated refund. **Note:** the webhook code
  already treats a Stripe subscription as active until Stripe actually ends it at
  period end — but this only happens if the Stripe Dashboard's Customer Portal
  (Settings → Billing → Customer portal) is configured for "cancel at period end"
  rather than "cancel immediately". That's a one-time setting only you can toggle
  in your own Stripe account.
- `/dashboard` — private analytics, for you, not customers (see below).

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

## Photo / PDF bill reading

Customers can take a photo, upload a photo, or upload a PDF of their bill
instead of typing in their usage. Photos are resized in the browser first;
PDFs are sent as-is. Either way it's posted to `app/api/extract-bill`, read
by Claude (Anthropic's API — images as an image block, PDFs as a document
block), and the extracted numbers autofill the existing form — the form
itself is the "check this looks right" step, nothing is calculated or saved
until the customer reviews it. The file itself is never stored, only the
numbers read off it. Needs `ANTHROPIC_API_KEY` (server-only) — without it,
this feature quietly stays off and manual entry still works.

## Subscriptions (paid "ongoing monitoring & alerts")

The free comparator above always stays free with no sign-up. On top of it,
customers can pay — monthly, quarterly, half-yearly, or a once-off payment —
for ongoing monitoring: the promise is that VIC Energy Check keeps watching
the market and alerts them when something cheaper appears, rather than them
having to re-check manually.

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

### The actual monitoring job

`app/api/cron/recheck-prices` is the automated part of the promise: Vercel
runs it once a day (configured in `vercel.json` — Vercel reads this file
automatically, no extra setup needed in the Vercel dashboard for the
schedule itself). Each run:

1. Re-prices every paying subscriber's saved usage against today's
   `lib/plans.ts` data. If something's now cheaper than what they were last
   told about, it emails them the "ongoing monitoring" alert — the actual
   paid deliverable.
2. Re-prices every free lead who ticked "also tell me about cheaper plans"
   (a checkbox next to the one-off email-me-this-result box on `/check`).
   If something's cheaper, it emails a nudge pointing back at the site and
   the paid plans — this is the growth/marketing side of it, kept separate
   from and clearly labelled apart from the paid alerts.
3. Every alert email has an unsubscribe link (`/api/unsubscribe`) that marks
   that person as opted out — required to stay on the right side of
   Australia's Spam Act, and just good practice.

**Important nuance:** this job only finds a *new* cheaper plan when
`lib/plans.ts` itself has been refreshed (see "Plan data" above) — it
doesn't pull fresh prices from retailers on its own, it just re-runs the
comparison using whatever plan data is currently live. If you haven't
refreshed `lib/plans.ts` in a while, the job will run every day but quietly
find nothing new to say.

Needs `RESEND_API_KEY` (see `.env.local.example`) to actually send
anything — without it, the job runs and does nothing, logging a note, rather
than erroring.

## Customer accounts

`/account` lets a customer see which plan they're on and manage their own
billing, without you doing it for them. Sign-in is **passwordless** (a Supabase
Auth "magic link" emailed to them) — there's no separate sign-up step or
password to remember: the first time someone enters their email there, an
account is created automatically; every time after, the same link signs them
back in. No new env vars needed — it reuses the Supabase values already set.

- They only ever see their own plan — enforced by a database rule (Row Level
  Security policy in `supabase/schema.sql`), matched by email, not by anything
  the browser claims.
- "Manage billing" sends them to Stripe's own hosted Customer Portal (update
  card, see invoices, cancel) — nothing custom-built for that, which also
  closes the "no self-service cancellation" gap from earlier.

**Two one-off setup steps for this to work, both free, a few minutes each:**

1. **Supabase → Authentication → URL Configuration**: add
   `https://<your-site>/account` (and your site's base URL) to "Redirect
   URLs", so the sign-in link is allowed to send people back to your site.
2. **Stripe Dashboard → Settings → Billing → Customer portal**: click
   "Activate" (test mode and live mode are activated separately — do both
   once you're ready to go live). Until this is on, "Manage billing" shows a
   friendly error instead of working.

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
   (safe to re-run any time, including after this update — it only creates
   or adds what's missing, never touches existing data).
3. In Vercel: New Project > Import this repo > add the env vars from
   `.env.local.example` (Project Settings > Environment Variables) > Deploy.
   Vercel will also pick up `vercel.json` automatically and schedule the
   daily price-recheck job — nothing extra to click for that part.
4. **Only if you're switching on paid subscriptions:** in Stripe (on the
   account dedicated to this business — see "Subscriptions" above), add a
   webhook endpoint at `https://<your-site>/api/stripe-webhook` listening for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`, copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` in Vercel, and copy your Stripe secret key into
   `STRIPE_SECRET_KEY`. Redeploy after adding them.
5. **Only if you want the automatic alert emails actually sending:** sign up
   free at resend.com, create an API key, and put it in `RESEND_API_KEY` in
   Vercel. Also set `CRON_SECRET` to a random value (same value in Vercel as
   in `.env.local.example`'s comment suggests) so random visitors can't
   trigger the recheck job themselves. Redeploy after adding them. Until you
   verify your own domain in Resend, test sends will only land in the inbox
   of whatever email you signed up to Resend with — see the comment in
   `.env.local.example` for why.
6. **For customer accounts (`/account`) to work:** in Supabase, go to
   Authentication > URL Configuration and add `https://<your-site>/account`
   to Redirect URLs. In Stripe, go to Settings > Billing > Customer portal
   and click Activate. See "Customer accounts" above for more.

## Free manual check vs member bill reading
- `/check` is free: address → home profile → estimated usage (vs the typical ~4,000 kWh household), priced against every plan and the Victorian Default Offer at the household's own usage.
- Bill photo/PDF reading costs an Anthropic API call, so `/api/extract-bill` requires a logged-in member with an `active` subscription (checked server-side in `lib/memberAccess.ts`).
- Re-run `supabase/schema.sql` in Supabase to add the `home_profile` columns.

## Monthly checks, emails and limits
- `bill_checks` stores one saved check per member per month (auto, manual or from a bill). My Dashboard's monthly chart uses them; other months stay estimates.
- `/api/cron/monthly-check` runs on the 1st (see `vercel.json`), records each active member's check and emails a short summary. Needs `RESEND_API_KEY`, `CRON_SECRET`, `SITE_URL`.
- Bill reads are capped at 10 per member per day (`bill_reads`). The free manual check has no server cap; leads insert straight from the browser to Supabase.
- Re-run `supabase/schema.sql` to create `bill_checks` and `bill_reads`.
