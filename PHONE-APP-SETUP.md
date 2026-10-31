# Utilo on the home screen: setup (31 Oct 2026)

The site is now installable as a home-screen app, and members can turn on
phone notifications. Installing works as soon as you deploy. Notifications
need three steps first.

## 1. Add the table (Supabase, 1 minute)
Supabase > SQL Editor > paste the block at the bottom of `supabase/schema.sql`
that starts `-- 31 Oct 2026: phone notifications` > Run.

## 2. Make your notification keys (your computer, 1 minute)
In a terminal, run:

    npx web-push generate-vapid-keys

It prints a Public Key and a Private Key. Keep the private key to yourself:
it goes into Vercel and nowhere else (not in chat, not in an email).

## 3. Put them in Vercel
Vercel > your project > Settings > Environment Variables (Production):

- `VAPID_PUBLIC_KEY`  = the Public Key
- `VAPID_PRIVATE_KEY` = the Private Key
- `VAPID_SUBJECT`     = optional, e.g. `mailto:hello@utiloaustralia.com.au` (defaults to the site address)

Then redeploy. Until the keys are there, the "Phone notifications" switch
simply doesn't show; everything else works.

## 4. Try it on your phone
- **iPhone:** open the site in Safari > Share > Add to Home Screen > open Utilo from the home screen > Plus tab > Phone notifications: On > Send a test.
- **Android:** open the site in Chrome > tap "Install" on the banner (or the ⋮ menu > Install app) > Plus tab > Phone notifications: On > Send a test.

## What sends a notification
- A cheaper electricity or gas plan (same rule and amount as the email alert)
- A discount or fixed price ending (a month before, with the email)
- The monthly check on the 1st (only if the monthly summary is on)

Costs nothing: Apple, Google and Mozilla run the push services for free.
