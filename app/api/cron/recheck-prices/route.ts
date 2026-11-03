import { activeRowsToEmail } from "@/lib/oneMemberPerEmail";
import { NextRequest, NextResponse } from "next/server";
import { BIG_SAVING_PER_YEAR, QUIET_DAYS_AFTER_SWITCH } from "@/lib/dataPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, emailConfigured, sendHealthEmail } from "@/lib/email";
import { GAS_ZONES, rankGasPlans, type GasZone } from "@/lib/gasPlans";
import { topOpen } from "@/lib/planExtras";
import { cheaperForLead, cheaperForMember, cheaperGasForMember, dealEnding, followUpMembership, followUpWeek, renewalRecap, resultEmail, reviewAsk, switchReminderEmail, inviteFollowUp } from "@/lib/emailTemplates";
import { inviteFollowUpDue, INVITE_FOLLOW_UP_DAYS } from "@/lib/inviteFollowUp";
import { networkRewards } from "@/lib/networkRewards";
import { retentionDue } from "@/lib/memberRetention";
import { cleanNote, melbourneDay } from "@/lib/switchReminder";
import { reviewAskDue, reviewUrl, trackedReviewLink } from "@/lib/reviews";
import { daysWatched, recapDue, savedSince, RECAP_PLANS, type Episode } from "@/lib/renewalRecap";
import { marketActivity } from "@/lib/marketActivity";
import { FOUNDING_OFFER, findPlan, fmtPrice } from "@/lib/pricingPlans";
import { computeBest, isMeaningfullyCheaper, priceOfPlan, referenceForUsage } from "@/lib/priceWatch";
import { ratesFromJson } from "@/lib/billReconcile";
import { switchedPlanNow } from "@/lib/switched";
import type { CurrentRates } from "@/lib/billExtraction";
import { offerDates } from "@/lib/planTerms";
import type { Distributor } from "@/lib/plans";
import { rejectUnlessCron } from "@/lib/cronAuth";
import { PRIVACY } from "@/lib/about";
import { sendPush } from "@/lib/push";

// Vercel Cron (see vercel.json) hits this once a day. It re-prices every
// saved profile against today's lib/plans.ts data and emails anyone for whom
// something cheaper has turned up since we last told them. It only finds
// NEW plans when lib/plans.ts itself has been refreshed (see README "Photo
// bill reading" / plan data section) — this job doesn't pull fresh market
// data on its own, it just re-runs the comparison whenever it's called.
export const maxDuration = 60;

interface SubscriberWatchRow {
  customer_name?: string | null;
  home_profile?: unknown;
  id: string;
  email: string;
  status: string;
  distributor: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  solar_export_kwh: number | null;
  demand_kw?: number | null;
  baseline_total: number | null;
  reference_total: number | null;
  last_notified_total: number | null;
  last_notified_retailer?: string | null;
  last_notified_plan_name?: string | null;
  baseline_retailer?: string | null;
  baseline_plan_name?: string | null;
  switched_at?: string | null;
}

interface LeadWatchRow {
  customer_name?: string | null;
  home_profile?: unknown;
  solar_export_kwh?: number | null;
  id: string;
  email: string;
  distributor: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  best_retailer: string | null;
  best_total: number | null;
  last_notified_total: number | null;
}

function siteOrigin(req: NextRequest): string {
  return process.env.SITE_URL || req.nextUrl.origin;
}

interface GasRow {
  customer_name?: string | null;
  id: string;
  email: string;
  gas_zone: string | null;
  gas_billing_days: number | null;
  gas_mj: number | null;
  gas_reference_total: number | null;
  gas_best_total: number | null;
  gas_best_retailer?: string | null;
  gas_best_plan_name?: string | null;
}

/** "A new offer from GloBird Energy, released 3 Oct 2026." for the alert email. */
function offerNote(retailer: string, plan: string): string | null {
  const d = offerDates(retailer, plan);
  if (d.badge === "New") return `This is a new offer from ${retailer}${d.badgeDate ? `, released ${d.badgeDate}` : ""}.`;
  if (d.badge === "Price change") return `${retailer} updated this offer${d.badgeDate ? ` on ${d.badgeDate}` : ""}.`;
  return d.label ? `${d.label}.` : null;
}

function unsubUrl(origin: string, type: "subscriber" | "lead", id: string): string {
  return `${origin}/api/unsubscribe?type=${type}&id=${id}`;
}

export async function GET(req: NextRequest) {
  // Vercel sends an Authorization header matching CRON_SECRET when that env
  // var is set (see vercel.json) — set CRON_SECRET in Vercel before relying
  // on this in production so random visitors to the URL can't trigger it.
  const denied = rejectUnlessCron(req);
  if (denied) return denied;

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: "Supabase not configured — nothing to recheck." });
  }
  if (!emailConfigured) {
    return NextResponse.json({
      ok: true,
      message: "RESEND_API_KEY isn't set yet — recheck skipped (nothing to send alert emails with).",
    });
  }

  const origin = siteOrigin(req);
  let subscribersNotified = 0;
  let leadsNotified = 0;
  let errors = 0;

  // --- Paying subscribers: the actual promised "ongoing monitoring" alert ---
  const { data: subsData, error: subsErr } = await supabaseAdmin
    .from("subscribers")
    .select(
      "id, email, status, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, baseline_total, reference_total, last_notified_total, last_notified_retailer, last_notified_plan_name, baseline_retailer, baseline_plan_name, switched_at, home_profile, customer_name",
    )
    .eq("status", "active")
    .eq("unsubscribed", false)
    .not("distributor", "is", null);

  if (subsErr) {
    console.error("recheck-prices: failed to load subscribers", subsErr);
    errors++;
  }

  // Each member's own alert minimum (A$ a year), if they've set one. Loaded
  // separately so an older database without the column still sends alerts.
  const alertMin = new Map<string, number>();
  {
    const { data: mins, error: minErr } = await supabaseAdmin.from("subscribers").select("id, alert_min_saving").eq("status", "active").not("alert_min_saving", "is", null);
    if (!minErr) for (const m of (mins ?? []) as { id: string; alert_min_saving: number | null }[]) if (typeof m.alert_min_saving === "number") alertMin.set(m.id, m.alert_min_saving);
  }
  // Each member's own rates, to check the bill total on file fits the usage
  // on file before quoting a saving against it. Loaded separately too.
  const ratesOf = new Map<string, CurrentRates>();
  {
    const { data: rs, error: rErr } = await supabaseAdmin.from("subscribers").select("id, current_rates").eq("status", "active").not("current_rates", "is", null);
    if (!rErr) for (const x of (rs ?? []) as { id: string; current_rates: unknown }[]) { const r = ratesFromJson(x.current_rates); if (r) ratesOf.set(x.id, r); }
  }

  // Who each member is with now, for "same retailer, different plan" (2 Nov 2026). Loaded separately too.
  const withNow = new Map<string, string>();
  {
    const { data: cs, error: cErr } = await supabaseAdmin.from("subscribers").select("id, current_retailer, switched_to, switched_at").eq("status", "active");
    if (!cErr)
      for (const x of (cs ?? []) as { id: string; current_retailer: string | null; switched_to: string | null; switched_at: string | null }[]) {
        const r = (x.switched_at && x.switched_to) || x.current_retailer;
        if (r) withNow.set(x.id, r);
      }
  }

  // One email per address, from the newest active membership (2 Nov 2026).
  const keep = await activeRowsToEmail(supabaseAdmin);
  const skip = (id: string) => !!keep && !keep.has(id);
  for (const sub of (subsData ?? []) as SubscriberWatchRow[]) {
    if (skip(sub.id)) continue;
    try {
      const profile = {
        distributor: sub.distributor as Distributor,
        billingDays: sub.billing_days ?? 91,
        peak: sub.peak_kwh ?? 0,
        shoulder: sub.shoulder_kwh ?? 0,
        offpeak: sub.offpeak_kwh ?? 0,
        anytime: sub.anytime_kwh ?? 0,
        cl: sub.controlled_load_kwh ?? 0,
        solarExportKwh: sub.solar_export_kwh ?? 0,
        demandKw: sub.demand_kw ?? null,
        ev: hasEv(sub.home_profile),
      };
      const best = computeBest(profile);
      if (!best) continue;

      // Compare with the plan we last recommended, re-priced at today's prices,
      // so a retailer raising that plan's prices (or a new cheaper offer) is
      // caught. Falls back to the stored figure if that plan is no longer offered.
      const pickRetailer = sub.last_notified_retailer ?? sub.baseline_retailer ?? null;
      const pickPlan = sub.last_notified_plan_name ?? sub.baseline_plan_name ?? null;
      const pickToday = priceOfPlan(profile, pickRetailer, pickPlan);
      const previousBest = pickToday ?? sub.last_notified_total ?? sub.baseline_total;
      const days = sub.billing_days ?? 91;
      // 2 Nov 2026: when the last pick can't be re-priced today, the stored figure may be
      // for different usage (a newer bill since). A "saving" of over a third is that, not
      // the market: don't email it. Today's cheapest quietly becomes the new pick instead.
      if (pickToday === null && previousBest !== null && previousBest > best.bestTotal * 1.5) {
        console.log("recheck-prices: skipped an implausible alert", sub.id);
        // Quietly make today's cheapest the new pick, so tomorrow compares like with like.
        await supabaseAdmin.from("subscribers").update({ last_notified_total: best.bestTotal, last_notified_retailer: best.bestRetailer, last_notified_plan_name: best.bestPlanName }).eq("id", sub.id);
        continue;
      }
      if (!isMeaningfullyCheaper(best.bestTotal, previousBest, days, alertMin.get(sub.id))) continue;
      // Just switched? Leave them alone for a while unless the saving is big.
      if (sub.switched_at) {
        const sinceSwitch = (Date.now() - new Date(sub.switched_at).getTime()) / 86_400_000;
        const perYear = ((previousBest! - best.bestTotal) / days) * 365;
        if (sinceSwitch < QUIET_DAYS_AFTER_SWITCH && perYear < BIG_SAVING_PER_YEAR) continue;
      }

      const e = cheaperForMember({
        origin,
        retailer: best.bestRetailer,
        planName: best.bestPlanName,
        offerNote: offerNote(best.bestRetailer, best.bestPlanName),
        yearly: ((previousBest! - best.bestTotal) * 365) / days,
        unsubscribeUrl: unsubUrl(origin, "subscriber", sub.id),
        prevYear: (previousBest! * 365) / days,
        newYear: (best.bestTotal * 365) / days,
        prevRetailer: sub.last_notified_retailer ?? sub.baseline_retailer ?? null,
        name: sub.customer_name,
        currentRetailer: withNow.get(sub.id) ?? null,
      });
      const sent = await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html });

      if (sent) {
        subscribersNotified++;
        // The same news on their phone, if they turned notifications on.
        const save = Math.round(((previousBest! - best.bestTotal) * 365) / days);
        await sendPush(sub.email, { title: "A cheaper plan for you", body: `${best.bestRetailer} could save you about $${save.toLocaleString("en-AU")} a year. Tap to see it.`, url: "/account#compare", tag: "cheaper-electricity" });
        const notifiedAt = new Date().toISOString();
        await supabaseAdmin
          .from("subscribers")
          .update({
            last_notified_total: best.bestTotal,
            last_notified_retailer: best.bestRetailer,
            last_notified_plan_name: best.bestPlanName,
            last_notified_at: notifiedAt,
          })
          .eq("id", sub.id);

        // Roll the savings-history episode over: close whatever was running
        // and open a new one at today's (better) daily rate. Subscribers from
        // before reference_total existed just won't get a new episode — no
        // history to extend.
        const billingDays = sub.billing_days ?? 91;
        // The bill total, checked against the usage it's compared on.
        const ref = referenceForUsage(profile, sub.reference_total, ratesOf.get(sub.id) ?? null);
        if (sub.reference_total !== null && billingDays > 0 && !best.average && ref.vsBill) {
          await supabaseAdmin
            .from("savings_episodes")
            .update({ ended_at: notifiedAt })
            .eq("subscriber_id", sub.id)
            .is("ended_at", null);

          // Never negative: a plan that costs more than their bill isn't a saving.
          const dailyRate = Math.max(0, (ref.total - best.bestTotal) / billingDays);
          const { error: episodeErr } = await supabaseAdmin.from("savings_episodes").insert({
            subscriber_id: sub.id,
            email: sub.email,
            started_at: notifiedAt,
            daily_rate: dailyRate,
            best_retailer: best.bestRetailer,
            best_plan_name: best.bestPlanName,
            best_total: best.bestTotal,
          });
          if (episodeErr) console.error("recheck-prices: failed to open savings episode", sub.id, episodeErr);
        }
      }
    } catch (err) {
      console.error("recheck-prices: subscriber failed", sub.id, err);
      errors++;
    }
  }

  // --- Free leads who opted in: nudge them toward subscribing ---
  const { data: leadsData, error: leadsErr } = await supabaseAdmin
    .from("leads")
    .select(
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, best_retailer, best_total, last_notified_total, home_profile, customer_name",
    )
    .eq("wants_price_alerts", true)
    .eq("unsubscribed", false)
    .not("distributor", "is", null);

  if (leadsErr) {
    console.error("recheck-prices: failed to load leads", leadsErr);
    errors++;
  }

  for (const lead of (leadsData ?? []) as LeadWatchRow[]) {
    try {
      const best = computeBest({
        distributor: lead.distributor as Distributor,
        billingDays: lead.billing_days ?? 91,
        peak: lead.peak_kwh ?? 0,
        shoulder: lead.shoulder_kwh ?? 0,
        offpeak: lead.offpeak_kwh ?? 0,
        anytime: lead.anytime_kwh ?? 0,
        cl: lead.controlled_load_kwh ?? 0,
        solarExportKwh: lead.solar_export_kwh ?? 0,
        ev: hasEv(lead.home_profile),
      });
      if (!best) continue;

      const previousBest = lead.last_notified_total ?? lead.best_total;
      if (!isMeaningfullyCheaper(best.bestTotal, previousBest, lead.billing_days ?? 91)) continue;

      const e = cheaperForLead({
        origin,
        offerNote: offerNote(best.bestRetailer, best.bestPlanName),
        previousRetailer: lead.best_retailer,
        retailer: best.bestRetailer,
        planName: best.bestPlanName,
        yearly: ((previousBest! - best.bestTotal) * 365) / (lead.billing_days ?? 91),
        unsubscribeUrl: unsubUrl(origin, "lead", lead.id),
        name: lead.customer_name,
        prevYear: (previousBest! * 365) / (lead.billing_days ?? 91),
        newYear: (best.bestTotal * 365) / (lead.billing_days ?? 91),
      });
      const sent = await sendEmail({ to: lead.email, subject: e.subject, title: e.title, html: e.html });

      if (sent) {
        leadsNotified++;
        await supabaseAdmin
          .from("leads")
          .update({
            last_notified_total: best.bestTotal,
            last_notified_retailer: best.bestRetailer,
            last_notified_plan_name: best.bestPlanName,
            last_notified_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      }
    } catch (err) {
      console.error("recheck-prices: lead failed", lead.id, err);
      errors++;
    }
  }

  // --- Deal-ending alerts: a month before a member's discount / benefit
  // period or fixed price ends, tell them and show today's cheapest plan.
  // Separate query so a database without these columns yet doesn't stop the rest.
  let dealAlerts = 0;
  const { data: dealSubs, error: dealErr } = await supabaseAdmin
    .from("subscribers")
    .select("id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, home_profile, discount_ends_at, current_price_fixed_until, deal_alert_sent_for, switched_at, switched_to, customer_name")
    .eq("status", "active")
    .eq("unsubscribed", false)
    .or("discount_ends_at.not.is.null,current_price_fixed_until.not.is.null");
  if (dealErr) console.error("recheck-prices: deal dates not loaded (run supabase/schema.sql?)", dealErr.message);
  for (const sub of (dealSubs ?? []) as DealRow[]) {
    if (skip(sub.id)) continue;
    try {
      const due = [
        { date: sub.discount_ends_at, what: "discount (or benefit period)" },
        { date: sub.current_price_fixed_until, what: "fixed price" },
      ]
        .filter((d): d is { date: string; what: string } => !!d.date)
        .map((d) => ({ ...d, days: Math.round((new Date(`${d.date}T00:00:00Z`).getTime() - Date.now()) / 86_400_000) }))
        .filter((d) => d.days >= 0 && d.days <= DEAL_WARNING_DAYS && d.date !== sub.deal_alert_sent_for)
        .sort((x, y) => x.days - y.days)[0];
      if (!due) continue;
      const watch = sub.distributor
        ? {
            distributor: sub.distributor as Distributor,
            billingDays: sub.billing_days ?? 91,
            peak: sub.peak_kwh ?? 0,
            shoulder: sub.shoulder_kwh ?? 0,
            offpeak: sub.offpeak_kwh ?? 0,
            anytime: sub.anytime_kwh ?? 0,
            cl: sub.controlled_load_kwh ?? 0,
            solarExportKwh: sub.solar_export_kwh ?? 0,
        demandKw: sub.demand_kw ?? null,
            ev: hasEv(sub.home_profile),
          }
        : null;
      const best = watch ? computeBest(watch) : null;
      const when = new Date(`${due.date}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
      const days = sub.billing_days ?? 91;
      // Against the bill only when the bill total fits the usage on file.
      // Switched? Against the plan they're on now, not the old bill.
      const moved = watch && sub.switched_at ? switchedPlanNow(sub.switched_to, watch.distributor, { days: watch.billingDays, peak: watch.peak, shoulder: watch.shoulder, offpeak: watch.offpeak, anytime: watch.anytime, cl: watch.cl, solarExportKwh: watch.solarExportKwh }) : null;
      const ref = moved ? { total: moved.total, vsBill: true } : watch && sub.reference_total ? referenceForUsage(watch, sub.reference_total, ratesOf.get(sub.id) ?? null) : null;
      const yearly = best && ref?.vsBill && !best.average ? ((ref.total - best.bestTotal) * 365) / days : null;
      const e = dealEnding({
        origin,
        what: due.what,
        when,
        daysLeft: due.days,
        best: best ? { retailer: best.bestRetailer, planName: best.bestPlanName } : null,
        yearly,
        unsubscribeUrl: unsubUrl(origin, "subscriber", sub.id),
        nowYear: best && ref?.vsBill && !best.average ? (ref.total * 365) / days : null,
        bestYear: best && ref?.vsBill && !best.average ? (best.bestTotal * 365) / days : null,
        name: sub.customer_name,
      });
      const sent = await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html });
      if (sent) {
        dealAlerts++;
        const short = due.what.startsWith("discount") ? "discount" : "fixed price";
        await sendPush(sub.email, { title: `Your ${short} ends ${when}`, body: `In ${due.days} day${due.days === 1 ? "" : "s"}. Prices often go up then. Tap to see your options.`, url: "/account#compare", tag: "deal-ending" });
        await supabaseAdmin.from("subscribers").update({ deal_alert_sent_for: due.date }).eq("id", sub.id);
      }
    } catch (err) {
      console.error("recheck-prices: deal alert failed", sub.id, err);
      errors++;
    }
  }

  // --- Follow-up sequence for free leads: day 1, day 3, day 7 after their check ---
  // Skips anyone who has since subscribed or unsubscribed.
  let dripSent = 0;
  const { data: dripLeads, error: dripErr } = await supabaseAdmin
    .from("leads")
    .select("id, email, created_at, drip_step, best_retailer, best_plan_name, estimated_saving, billing_days, wants_price_alerts, best_total, current_bill, customer_name")
    // Everyone who asked gets their result (step 0). Follow-ups (steps 1-2)
    // only go to people who ticked the box (Spam Act consent).
    .or("wants_price_alerts.eq.true,drip_step.eq.0")
    .eq("unsubscribed", false)
    .lt("drip_step", 3)
    .lte("created_at", new Date(Date.now() - 1 * 86_400_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(200);
  if (dripErr) {
    console.error("recheck-prices: failed to load drip leads", dripErr);
    errors++;
  }
  const { data: subEmails } = await supabaseAdmin.from("subscribers").select("email").in(
    "email",
    (dripLeads ?? []).map((l: { email: string }) => l.email),
  );
  const subscribed = new Set((subEmails ?? []).map((r: { email: string }) => r.email));
  const DRIP_DAYS = [1, 3, 7];
  for (const lead of (dripLeads ?? []) as DripLeadRow[]) {
    try {
      if (subscribed.has(lead.email)) {
        await supabaseAdmin.from("leads").update({ drip_step: 3 }).eq("id", lead.id);
        continue;
      }
      const ageDays = (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000;
      const step = lead.drip_step; // 0, 1 or 2 → next email is DRIP_DAYS[step]
      if (step >= 1 && !lead.wants_price_alerts) {
        await supabaseAdmin.from("leads").update({ drip_step: 3 }).eq("id", lead.id);
        continue;
      }
      if (ageDays < DRIP_DAYS[step]) continue;
      const rawYearly = lead.estimated_saving && lead.billing_days ? (lead.estimated_saving / lead.billing_days) * 365 : null;
      // No "you're losing $X a week" emails to people already on a good deal.
      const yearly = rawYearly !== null && rawYearly >= 1 ? rawYearly : null;
      const unsub = unsubUrl(origin, "lead", lead.id);
      const e =
        step === 0
          ? resultEmail({ origin, retailer: lead.best_retailer ?? "the cheapest plan", planName: lead.best_plan_name, yearly: yearly ?? 0, vsBill: false, unsubscribeUrl: unsub, sentLater: true, name: lead.customer_name })
          : step === 1
            ? followUpMembership({
                origin, unsubscribeUrl: unsub, name: lead.customer_name, retailer: lead.best_retailer,
                nowYear: lead.best_total != null && lead.estimated_saving != null && lead.billing_days ? ((lead.best_total + lead.estimated_saving) * 365) / lead.billing_days : null,
                bestYear: lead.best_total != null && lead.billing_days ? (lead.best_total * 365) / lead.billing_days : null,
                vsBill: lead.current_bill != null,
              })
            : followUpWeek({
                origin, retailer: lead.best_retailer, planName: lead.best_plan_name, yearly, unsubscribeUrl: unsub,
                // Both a year, from what the result showed: what they pay (or the default offer) and the cheapest.
                nowYear: lead.best_total != null && lead.estimated_saving != null && lead.billing_days ? ((lead.best_total + lead.estimated_saving) * 365) / lead.billing_days : null,
                bestYear: lead.best_total != null && lead.billing_days ? (lead.best_total * 365) / lead.billing_days : null,
                vsBill: lead.current_bill != null,
                name: lead.customer_name,
              });
      const sent = await sendEmail({ to: lead.email, subject: e.subject, title: e.title, html: e.html });
      if (sent) {
        dripSent++;
        await supabaseAdmin.from("leads").update({ drip_step: step + 1, drip_sent_at: new Date().toISOString() }).eq("id", lead.id);
      }
    } catch (err) {
      console.error("recheck-prices: drip failed", lead.id, err);
      errors++;
    }
  }

  // --- Gas: members with a gas bill on file are re-priced too, and told when a
  // gas plan beats our last gas pick by the member's alert minimum ($50 a year unless they changed it).
  let gasAlerts = 0;
  const { data: gasSubs, error: gasErr } = await supabaseAdmin
    .from("subscribers")
    .select("id, email, gas_zone, gas_billing_days, gas_mj, gas_reference_total, gas_best_total, gas_best_retailer, gas_best_plan_name, customer_name")
    .eq("status", "active")
    .eq("unsubscribed", false)
    .not("gas_zone", "is", null)
    .not("gas_mj", "is", null);
  if (gasErr) console.error("recheck-prices: gas members not loaded", gasErr.message);
  for (const sub of (gasSubs ?? []) as GasRow[]) {
    if (skip(sub.id)) continue;
    try {
      if (!GAS_ZONES.includes(sub.gas_zone as GasZone) || !sub.gas_mj) continue;
      const gDays = sub.gas_billing_days ?? 91;
      const gasRanked = rankGasPlans(sub.gas_zone as GasZone, { days: gDays, mj: sub.gas_mj });
      const top = topOpen(gasRanked);
      if (!top) continue;
      // Re-price our last gas pick at today's prices, as for electricity.
      const pickToday = gasRanked.find((m) => m.plan[0] === sub.gas_best_retailer && m.plan[2] === sub.gas_best_plan_name)?.total ?? null;
      const previous = pickToday ?? sub.gas_best_total ?? sub.gas_reference_total;
      if (!isMeaningfullyCheaper(top.total, previous, gDays, alertMin.get(sub.id))) continue;
      const e = cheaperGasForMember({
        origin,
        retailer: top.plan[0],
        planName: top.plan[2],
        yearly: ((previous! - top.total) * 365) / gDays,
        vsBill: sub.gas_reference_total !== null,
        unsubscribeUrl: unsubUrl(origin, "subscriber", sub.id),
        prevYear: (previous! * 365) / gDays,
        newYear: (top.total * 365) / gDays,
        name: sub.customer_name,
      });
      const sent = await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html });
      if (sent) {
        gasAlerts++;
        const gSave = Math.round(((previous! - top.total) * 365) / gDays);
        await sendPush(sub.email, { title: "A cheaper gas plan for you", body: `${top.plan[0]} could save you about $${gSave.toLocaleString("en-AU")} a year on gas. Tap to see it.`, url: "/account", tag: "cheaper-gas" });
        await supabaseAdmin
          .from("subscribers")
          .update({ gas_best_retailer: top.plan[0], gas_best_plan_name: top.plan[2], gas_best_total: top.total, gas_updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    } catch (err) {
      console.error("recheck-prices: gas member failed", sub.id, err);
      errors++;
    }
  }

  // Privacy: the IP address on a free bill-read record (for the daily limit)
  // is only kept for PRIVACY.billReadRetentionDays. Records that carry the
  // free allowance (a device ID or an email) keep the date and fuel, without
  // the IP, for PRIVACY.freeAllowanceDays; everything else goes (see the Privacy Policy).
  const ipCutoff = new Date(Date.now() - PRIVACY.billReadRetentionDays * 86_400_000).toISOString();
  const allowanceCutoff = new Date(Date.now() - PRIVACY.freeAllowanceDays * 86_400_000).toISOString();
  let { error: purgeErr } = await supabaseAdmin.from("bill_reads").delete().lt("created_at", ipCutoff).is("device", null).is("lead_email", null);
  if (purgeErr && /column|schema cache/i.test(purgeErr.message)) {
    // Database without the allowance columns yet: the old rule.
    ({ error: purgeErr } = await supabaseAdmin.from("bill_reads").delete().lt("created_at", ipCutoff));
  } else if (!purgeErr) {
    await supabaseAdmin.from("bill_reads").update({ email: "allowance" }).lt("created_at", ipCutoff).like("email", "ip:%");
    await supabaseAdmin.from("bill_reads").delete().lt("created_at", allowanceCutoff);
  }
  if (purgeErr) console.error("recheck-prices: bill_reads clean-up failed", purgeErr.message);

  // --- Yearly recap, two weeks before a membership renews (2 Nov 2026) ---
  let recaps = 0;
  const recapped = new Set<string>();
  {
    const soon = new Date(Date.now() + 15 * 86_400_000).toISOString();
    const RECAP_COLS = "id, email, status, plan, amount_cents, created_at, current_period_end, recap_sent_for, distributor, billing_days, reference_total, baseline_total, baseline_retailer, switched_at, customer_name";
    const recapQuery = (cols: string) => supabaseAdmin!
      .from("subscribers")
      .select(cols)
      .eq("status", "active")
      .in("plan", [...RECAP_PLANS])
      .lte("current_period_end", soon)
      .gte("current_period_end", new Date().toISOString());
    // With the review column when the database has it (2 Nov 2026), without it otherwise.
    let { data: due, error: dueErr } = await recapQuery(`${RECAP_COLS}, review_clicked_at`);
    if (dueErr && /column|schema cache/i.test(dueErr.message)) ({ data: due, error: dueErr } = await recapQuery(RECAP_COLS));
    if (dueErr) console.warn("recheck-prices: renewal recaps off (run supabase/schema.sql)", dueErr.message);
    for (const sub of (due ?? []) as unknown as RecapRow[]) {
      if (skip(sub.id)) continue;
      try {
        if (!recapDue({ plan: sub.plan, status: sub.status, periodEnd: sub.current_period_end, sentFor: sub.recap_sent_for })) continue;
        const { data: eps } = await supabaseAdmin.from("savings_episodes").select("started_at, ended_at, daily_rate").eq("subscriber_id", sub.id);
        const days = sub.billing_days ?? 91;
        const perYear = 365 / days;
        const yearStart = new Date(Math.max(Date.parse(sub.created_at), Date.parse(sub.current_period_end!) - 365 * 86_400_000)).toISOString();
        const market = sub.distributor ? marketActivity({ network: sub.distributor as Distributor, since: yearStart }) : null;
        const available = sub.reference_total !== null && sub.baseline_total !== null ? (sub.reference_total - sub.baseline_total) * perYear : null;
        const plan = findPlan(sub.plan);
        const price = sub.amount_cents ?? plan?.priceCents ?? 0;
        const cadence = sub.plan === "annual" ? "a year" : sub.plan === "half_yearly" ? "every 6 months" : "a quarter";
        const e = renewalRecap({
          origin,
          name: (sub.customer_name ?? "").trim().split(/\s+/)[0] || null,
          daysWatched: daysWatched(sub.created_at, sub.current_period_end!),
          marketChanges: market && market.ready ? market.newOffers + market.priceChanges : 0,
          network: sub.distributor,
          switched: !!sub.switched_at,
          savedSoFar: savedSince((eps ?? []) as Episode[], sub.switched_at),
          availableYear: available,
          bestRetailer: sub.baseline_retailer,
          nowYear: sub.reference_total !== null ? sub.reference_total * perYear : null,
          bestYear: sub.baseline_total !== null ? sub.baseline_total * perYear : null,
          renewsOn: new Date(sub.current_period_end!).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" }),
          priceLabel: `${fmtPrice(price)} ${cadence}`,
          // Founding members: on a price below today's list price, or joined while the founding offer is open.
          founding: plan ? price < plan.priceCents || (FOUNDING_OFFER && price === plan.priceCents) : false,
          unsubscribeUrl: unsubUrl(origin, "subscriber", sub.id),
          reviewLink: reviewUrl() && !sub.review_clicked_at ? trackedReviewLink(origin, sub.id, "recap") : null,
        });
        const sent = await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html });
        if (sent) {
          recaps++;
          recapped.add(sub.id);
          await supabaseAdmin.from("subscribers").update({ recap_sent_for: sub.current_period_end!.slice(0, 10) }).eq("id", sub.id);
        }
      } catch (err) {
        console.error("recheck-prices: renewal recap failed", sub.id, err);
        errors++;
      }
    }
  }

  // --- Member data retention (4 Nov 2026): the Privacy Policy says an ended membership's data is
  // deleted PRIVACY.memberRetentionDays after it ends. Never while the email has a live membership. ---
  let retentionDeleted = 0;
  {
    const cutoff = new Date(Date.now() - PRIVACY.memberRetentionDays * 86_400_000).toISOString();
    const { data: old, error: oldErr } = await supabaseAdmin
      .from("subscribers")
      .select("id, email, status, canceled_at, current_period_end")
      .eq("status", "canceled")
      .lt("current_period_end", cutoff)
      .limit(200);
    if (oldErr && !/column|schema cache/i.test(oldErr.message ?? "")) console.warn("recheck-prices: retention", oldErr.message);
    for (const r of (old ?? []) as { id: string; email: string; status: string; canceled_at: string | null; current_period_end: string | null }[]) {
      try {
        // ilike for case, with % and _ escaped so it matches this address only.
        const like = r.email.replace(/[%_\\]/g, "\\$&");
        const { data: live } = await supabaseAdmin.from("subscribers").select("id").ilike("email", like).in("status", ["active", "past_due"]).limit(1);
        if (!retentionDue(r, { days: PRIVACY.memberRetentionDays, otherLive: (live ?? []).length > 0 })) continue;
        // The membership (its savings history goes with it), then, once no membership rows are left for
        // this email, the member-only records kept by email. Free results and price alerts (leads) follow
        // their own rule: until they unsubscribe.
        const { error } = await supabaseAdmin.from("subscribers").delete().eq("id", r.id);
        if (error) throw error;
        const { data: rest } = await supabaseAdmin.from("subscribers").select("id").ilike("email", like).limit(1);
        if ((rest ?? []).length === 0) {
          for (const table of ["bills", "bill_checks", "push_subscriptions"]) {
            const { error: e2 } = await supabaseAdmin.from(table).delete().ilike("email", like);
            if (e2 && !/schema cache|does not exist/i.test(e2.message)) console.error(`recheck-prices: retention ${table}`, e2.message);
          }
        }
        retentionDeleted++;
      } catch (err) {
        console.error("recheck-prices: retention delete failed", r.id, err);
        errors++;
      }
    }
  }

  // --- Invite follow-up (3 Nov 2026): a look inside the dashboard, a week after the owner's invite, once ---
  let inviteFollowUps = 0;
  {
    const since = new Date(Date.now() - (INVITE_FOLLOW_UP_DAYS + 14) * 86_400_000).toISOString();
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("leads")
      .select("id, email, created_at, distributor, best_retailer, estimated_saving, best_total, billing_days, unsubscribed, invite_sent_at, invite_followup_at, customer_name")
      .not("invite_sent_at", "is", null)
      .gte("invite_sent_at", since)
      .order("created_at", { ascending: false });
    if (invErr && !/column|schema cache/i.test(invErr.message ?? "")) console.warn("recheck-prices: invite follow-ups", invErr.message);
    type InvRow = { id: string; email: string; distributor: string | null; best_retailer: string | null; estimated_saving: number | null; best_total: number | null; billing_days: number | null; unsubscribed: boolean | null; invite_sent_at: string | null; invite_followup_at: string | null; customer_name: string | null };
    // One per address: their newest check, and any unsubscribe or earlier follow-up on any of their rows.
    const byEmail = new Map<string, { latest: InvRow; unsub: boolean; followed: string | null; invited: string | null }>();
    for (const r of (inv ?? []) as InvRow[]) {
      const k = r.email.trim().toLowerCase();
      const cur = byEmail.get(k);
      if (!cur) byEmail.set(k, { latest: r, unsub: !!r.unsubscribed, followed: r.invite_followup_at, invited: r.invite_sent_at });
      else {
        cur.unsub ||= !!r.unsubscribed;
        cur.followed ||= r.invite_followup_at;
        if (r.invite_sent_at && (!cur.invited || r.invite_sent_at > cur.invited)) cur.invited = r.invite_sent_at;
      }
    }
    const emails = [...byEmail.keys()];
    const members = new Set<string>();
    if (emails.length) {
      const { data: ms } = await supabaseAdmin.from("subscribers").select("email").in("email", emails);
      for (const m of (ms ?? []) as { email: string }[]) members.add(m.email.trim().toLowerCase());
    }
    for (const [email, x] of byEmail) {
      if (!inviteFollowUpDue({ invitedAt: x.invited, followUpAt: x.followed, unsubscribed: x.unsub, isMember: members.has(email), now: new Date() })) continue;
      try {
        const r = x.latest;
        const days = r.billing_days && r.billing_days > 0 ? r.billing_days : null;
        const perYear = (v: number | null) => (v != null && days ? (v * 365) / days : null);
        const yearly = perYear(r.estimated_saving);
        const bestYear = perYear(r.best_total);
        const rw = r.distributor ? networkRewards(r.distributor) : null;
        const market = r.distributor ? marketActivity({ network: r.distributor as Distributor, days: 30 }) : null;
        const e = inviteFollowUp({
          origin,
          name: r.customer_name,
          retailer: r.best_retailer,
          yearly,
          nowYear: yearly !== null && bestYear !== null ? bestYear + yearly : null,
          bestYear,
          network: r.distributor,
          rewards: rw ? { ...rw.counts, topCredit: rw.topCredit, retailers: rw.retailers } : null,
          marketChanges: market?.ready ? market.newOffers + market.priceChanges : null,
          unsubscribeUrl: unsubUrl(origin, "lead", r.id),
        });
        if (await sendEmail({ to: r.email, subject: e.subject, title: e.title, html: e.html })) {
          inviteFollowUps++;
          await supabaseAdmin.from("leads").update({ invite_followup_at: new Date().toISOString() }).ilike("email", email.replace(/[%_\\]/g, "\\$&"));
        }
      } catch (err) {
        console.error("recheck-prices: invite follow-up failed", email, err);
        errors++;
      }
    }
  }

  // --- "Remind me" by email (2 Nov 2026): the member picked today. Sent once, then cleared. ---
  let reminders = 0;
  {
    const { data: rm, error: rmErr } = await supabaseAdmin
      .from("subscribers")
      .select("id, email, customer_name, nmi, switch_remind_on, switch_remind_note")
      .eq("status", "active")
      .not("switch_remind_on", "is", null)
      .lte("switch_remind_on", melbourneDay());
    if (rmErr && !/column|schema cache/i.test(rmErr.message ?? "")) console.warn("recheck-prices: reminders", rmErr.message);
    for (const row of (rm ?? []) as { id: string; email: string; customer_name: string | null; nmi: string | null; switch_remind_note: unknown }[]) {
      try {
        const n = cleanNote(row.switch_remind_note);
        if (n) {
          const e = switchReminderEmail({ origin, name: row.customer_name, retailer: n.retailer, planName: n.plan, savingYear: n.savingYear, same: n.same, nmi: row.nmi });
          if (!(await sendEmail({ to: row.email, subject: e.subject, title: e.title, html: e.html }))) continue; // try again tomorrow
          reminders++;
        }
        await supabaseAdmin.from("subscribers").update({ switch_remind_on: null, switch_remind_note: null }).eq("id", row.id);
      } catch (err) {
        console.error("recheck-prices: reminder failed", row.id, err);
        errors++;
      }
    }
  }

  // --- Google review requests (2 Nov 2026): lib/reviews.ts says who and when ---
  let reviewAsks = 0;
  if (reviewUrl()) {
    const { data: rv, error: rvErr } = await supabaseAdmin
      .from("subscribers")
      .select("id, email, status, created_at, switched_at, switched_to, cancel_at, unsubscribed, review_asks, review_asked_at, review_clicked_at, last_notified_at, customer_name")
      .eq("status", "active")
      .eq("unsubscribed", false)
      .lt("review_asks", 2)
      .is("review_clicked_at", null);
    if (rvErr) console.warn("recheck-prices: review requests off (run supabase/schema.sql)", rvErr.message);
    const now = Date.now();
    for (const sub of (rv ?? []) as ReviewRow[]) {
      if (skip(sub.id) || recapped.has(sub.id)) continue;
      // Never on the same day as another email from us.
      if (sub.last_notified_at && now - Date.parse(sub.last_notified_at) < 86_400_000) continue;
      const kind = reviewAskDue({ status: sub.status, cancelAt: sub.cancel_at, unsubscribed: sub.unsubscribed, createdAt: sub.created_at, switchedAt: sub.switched_at, asks: sub.review_asks ?? 0, askedAt: sub.review_asked_at, clickedAt: sub.review_clicked_at, now });
      if (!kind) continue;
      try {
        const e = reviewAsk({
          origin,
          name: sub.customer_name,
          kind,
          url: trackedReviewLink(origin, sub.id, kind),
          switchedTo: sub.switched_to,
          daysWatched: Math.round((now - Date.parse(sub.created_at)) / 86_400_000),
          unsubscribeUrl: unsubUrl(origin, "subscriber", sub.id),
        });
        if (await sendEmail({ to: sub.email, subject: e.subject, title: e.title, html: e.html })) {
          reviewAsks++;
          await supabaseAdmin.from("subscribers").update({ review_asks: (sub.review_asks ?? 0) + 1, review_asked_at: new Date().toISOString() }).eq("id", sub.id);
        }
      } catch (err) {
        console.error("recheck-prices: review request failed", sub.id, err);
        errors++;
      }
    }
  }

  await sendHealthEmail("daily recheck", {
    "review requests": reviewAsks,
    "switch reminders": reminders,
    "invite follow-ups": inviteFollowUps,
    "ended memberships deleted (retention)": retentionDeleted,
    "renewal recaps": recaps,
    "members checked": (subsData ?? []).length,
    "members alerted": subscribersNotified,
    "free users alerted": leadsNotified,
    "follow-up emails sent": dripSent,
    "deal-ending alerts": dealAlerts,
    "gas alerts": gasAlerts,
    errors,
  });
  return NextResponse.json({ ok: true, subscribersNotified, leadsNotified, dripSent, dealAlerts, gasAlerts, recaps, reviewAsks, reminders, inviteFollowUps, errors });
}

/** Warn this many days before a discount or fixed price ends. */
const DEAL_WARNING_DAYS = 30;

interface DealRow {
  customer_name?: string | null;
  id: string;
  email: string;
  distributor: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  solar_export_kwh: number | null;
  demand_kw?: number | null;
  reference_total: number | null;
  home_profile: unknown;
  discount_ends_at: string | null;
  current_price_fixed_until: string | null;
  deal_alert_sent_for: string | null;
  switched_at?: string | null;
  switched_to?: string | null;
}

interface DripLeadRow {
  customer_name?: string | null;
  wants_price_alerts?: boolean;
  id: string;
  email: string;
  created_at: string;
  drip_step: number;
  best_retailer: string | null;
  best_plan_name: string | null;
  estimated_saving: number | null;
  billing_days: number | null;
  best_total?: number | null;
  current_bill?: number | null;
}

interface ReviewRow {
  id: string;
  email: string;
  status: string;
  created_at: string;
  switched_at: string | null;
  switched_to: string | null;
  cancel_at: string | null;
  unsubscribed: boolean;
  review_asks: number | null;
  review_asked_at: string | null;
  review_clicked_at: string | null;
  last_notified_at: string | null;
  customer_name: string | null;
}

interface RecapRow {
  review_clicked_at?: string | null;
  id: string;
  email: string;
  status: string;
  plan: string;
  amount_cents: number | null;
  created_at: string;
  current_period_end: string | null;
  recap_sent_for: string | null;
  distributor: string | null;
  billing_days: number | null;
  reference_total: number | null;
  baseline_total: number | null;
  baseline_retailer: string | null;
  switched_at: string | null;
  customer_name: string | null;
}

/** True when the saved home answers say they charge an EV at home. */
function hasEv(profile: unknown): boolean {
  return !!profile && typeof profile === "object" && (profile as { ev?: unknown }).ev === true;
}

