import { NextRequest, NextResponse } from "next/server";
import { BIG_SAVING_PER_YEAR, PRICE_CHANGE_CLAUSE, QUIET_DAYS_AFTER_SWITCH } from "@/lib/dataPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { esc, sendEmail, emailConfigured, sendHealthEmail } from "@/lib/email";
import { computeBest, isMeaningfullyCheaper, fmtCurrency } from "@/lib/priceWatch";
import type { Distributor } from "@/lib/plans";
import { rejectUnlessCron } from "@/lib/cronAuth";

// Vercel Cron (see vercel.json) hits this once a day. It re-prices every
// saved profile against today's lib/plans.ts data and emails anyone for whom
// something cheaper has turned up since we last told them. It only finds
// NEW plans when lib/plans.ts itself has been refreshed (see README "Photo
// bill reading" / plan data section) — this job doesn't pull fresh market
// data on its own, it just re-runs the comparison whenever it's called.
export const maxDuration = 60;

interface SubscriberWatchRow {
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
  baseline_total: number | null;
  reference_total: number | null;
  last_notified_total: number | null;
  switched_at?: string | null;
}

interface LeadWatchRow {
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

function unsubscribeFooter(origin: string, type: "subscriber" | "lead", id: string, extra?: string): string {
  return `
    <p style="margin-top:24px;font-size:12px;color:#888;">
      ${extra ? extra + " " : ""}
      <a href="${origin}/api/unsubscribe?type=${type}&id=${id}">Unsubscribe from these emails</a>.
    </p>`;
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
      "id, email, status, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, baseline_total, reference_total, last_notified_total, switched_at, home_profile",
    )
    .eq("status", "active")
    .eq("unsubscribed", false)
    .not("distributor", "is", null);

  if (subsErr) {
    console.error("recheck-prices: failed to load subscribers", subsErr);
    errors++;
  }

  for (const sub of (subsData ?? []) as SubscriberWatchRow[]) {
    try {
      const best = computeBest({
        distributor: sub.distributor as Distributor,
        billingDays: sub.billing_days ?? 91,
        peak: sub.peak_kwh ?? 0,
        shoulder: sub.shoulder_kwh ?? 0,
        offpeak: sub.offpeak_kwh ?? 0,
        anytime: sub.anytime_kwh ?? 0,
        cl: sub.controlled_load_kwh ?? 0,
        solarExportKwh: sub.solar_export_kwh ?? 0,
        ev: hasEv(sub.home_profile),
      });
      if (!best) continue;

      const previousBest = sub.last_notified_total ?? sub.baseline_total;
      const days = sub.billing_days ?? 91;
      if (!isMeaningfullyCheaper(best.bestTotal, previousBest, days)) continue;
      // Just switched? Leave them alone for a while unless the saving is big.
      if (sub.switched_at) {
        const sinceSwitch = (Date.now() - new Date(sub.switched_at).getTime()) / 86_400_000;
        const perYear = ((previousBest! - best.bestTotal) / days) * 365;
        if (sinceSwitch < QUIET_DAYS_AFTER_SWITCH && perYear < BIG_SAVING_PER_YEAR) continue;
      }

      const sent = await sendEmail({
        to: sub.email,
        subject: "A cheaper electricity plan just showed up for you",
        cta: { label: "See it on your dashboard", url: `${origin}/account#compare` },
        html: `
          <p>Good news: while keeping an eye on the market for you, we found a plan that beats the one we last recommended.</p>
          <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">${esc(best.bestRetailer)} (${esc(best.bestPlanName)})</p>
          <p style="margin:0 0 16px;">About <strong>${fmtCurrency(((previousBest! - best.bestTotal) * 365) / days)} a year</strong> cheaper than our last pick for you.</p>
          <p><a href="${origin}/account#compare">See every plan and how to switch →</a></p>
          <p style="color:#666;font-size:13px;">${PRICE_CHANGE_CLAUSE}</p>
          ${unsubscribeFooter(
            origin,
            "subscriber",
            sub.id,
            "You're getting this because you're subscribed to Utilo's ongoing monitoring. This link won't cancel your membership; you can manage or cancel it any time from your dashboard.",
          )}
        `,
      });

      if (sent) {
        subscribersNotified++;
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
        if (sub.reference_total !== null && billingDays > 0) {
          await supabaseAdmin
            .from("savings_episodes")
            .update({ ended_at: notifiedAt })
            .eq("subscriber_id", sub.id)
            .is("ended_at", null);

          // Never negative: a plan that costs more than their bill isn't a saving.
          const dailyRate = Math.max(0, (sub.reference_total - best.bestTotal) / billingDays);
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
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, best_retailer, best_total, last_notified_total, home_profile",
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

      const sent = await sendEmail({
        to: lead.email,
        subject: "A cheaper electricity plan just showed up in your area",
        cta: { label: "See it and switch", url: `${origin}/check` },
        html: `
          <p>When you checked your plan with Utilo, the best match was ${esc(lead.best_retailer ?? "your previous result")}. We just found something cheaper:</p>
          <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">${esc(best.bestRetailer)} (${esc(best.bestPlanName)})</p>
          <p style="margin:0 0 16px;">About <strong>${fmtCurrency(((previousBest! - best.bestTotal) * 365) / (lead.billing_days ?? 91))} a year</strong> cheaper than that earlier match.</p>
          <p><a href="${origin}/check">See it and switch →</a></p>
          <p style="color:#666;font-size:13px;">${PRICE_CHANGE_CLAUSE}</p>
          <p>Want us to keep doing this automatically from now on, instead of waiting for an email like this one?
          <a href="${origin}/check#pricing">See ongoing monitoring plans →</a></p>
          ${unsubscribeFooter(origin, "lead", lead.id, "You're getting this because you asked to be told about cheaper plans.")}
        `,
      });

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
    .select("id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, solar_export_kwh, reference_total, home_profile, discount_ends_at, current_price_fixed_until, deal_alert_sent_for")
    .eq("status", "active")
    .eq("unsubscribed", false)
    .or("discount_ends_at.not.is.null,current_price_fixed_until.not.is.null");
  if (dealErr) console.error("recheck-prices: deal dates not loaded (run supabase/schema.sql?)", dealErr.message);
  for (const sub of (dealSubs ?? []) as DealRow[]) {
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
      const best = sub.distributor
        ? computeBest({
            distributor: sub.distributor as Distributor,
            billingDays: sub.billing_days ?? 91,
            peak: sub.peak_kwh ?? 0,
            shoulder: sub.shoulder_kwh ?? 0,
            offpeak: sub.offpeak_kwh ?? 0,
            anytime: sub.anytime_kwh ?? 0,
            cl: sub.controlled_load_kwh ?? 0,
            solarExportKwh: sub.solar_export_kwh ?? 0,
            ev: hasEv(sub.home_profile),
          })
        : null;
      const when = new Date(`${due.date}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
      const days = sub.billing_days ?? 91;
      const yearly = best && sub.reference_total ? ((sub.reference_total - best.bestTotal) * 365) / days : null;
      const sent = await sendEmail({
        to: sub.email,
        subject: `Your ${due.what} ends on ${when}`,
        cta: { label: "See your options", url: `${origin}/account#compare` },
        html: `
          <p>Heads up: your electricity ${esc(due.what)} ends on <strong>${esc(when)}</strong> (in ${due.days} days). Prices often go up when that happens.</p>
          ${best ? `<p style="font-size:18px;font-weight:700;margin:16px 0 4px;">Cheapest for you today: ${esc(best.bestRetailer)} (${esc(best.bestPlanName)})</p>` : ""}
          ${yearly !== null && yearly >= 50 ? `<p style="margin:0 0 16px;">About <strong>${fmtCurrency(yearly)} a year</strong> less than your last bill, before your current deal ends.</p>` : ""}
          <p>Now is a good time to compare and, if it's worth it, switch or ask your retailer to match it.</p>
          <p><a href="${origin}/account#compare">See every plan on your dashboard →</a></p>
          ${unsubscribeFooter(origin, "subscriber", sub.id, "You're getting this because you're a Utilo member and told us when your deal ends.")}
        `,
      });
      if (sent) {
        dealAlerts++;
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
    .select("id, email, created_at, drip_step, best_retailer, best_plan_name, estimated_saving, billing_days, wants_price_alerts")
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
      const plan = lead.best_retailer ? esc(`${lead.best_retailer}${lead.best_plan_name ? ` (${lead.best_plan_name})` : ""}`) : "the plan we found";
      const emails = [
        {
          subject: yearly ? `Your result: about ${fmtCurrency(yearly)} a year` : "Your Utilo result",
          html: `
            <p>Here's your result from yesterday's check, so it's easy to find.</p>
            <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">${plan}</p>
            ${yearly ? `<p style="margin:0 0 16px;">About <strong>${fmtCurrency(yearly)}</strong> a year cheaper than the benchmark we compared against.</p>` : ""}
            <p><a href="${origin}/check">See the plan and how to switch →</a></p>
            <p style="color:#666;">Switching takes about ten minutes online, your power stays on, and you can change your mind within 10 business days.</p>`,
        },
        {
          subject: "Prices move. We can keep watching for you",
          html: `
            <p>Retailers change their plans through the year, so a plan that's cheapest today may not be in a few months.</p>
            <p>Members get a check every morning, an email only when it's worth switching, bill reading from a photo, and a running tally of what they've saved. $39 a year (or $7 month to month), cancel any time.</p>
            <p><a href="${origin}/pricing">See what members get →</a></p>`,
        },
        {
          subject: yearly ? `Still paying the old rate? That's ${fmtCurrency(yearly / 52)} a week` : "A week on: did you switch?",
          html: `
            <p>A week ago we found <strong>${plan}</strong> for you.${yearly ? ` Every week on the old plan is about ${fmtCurrency(yearly / 52)} you don't get back.` : ""}</p>
            <p><a href="${origin}/check">Run the check again with today's prices →</a></p>
            <p>If you've already switched, nice work. This is the last of these emails.</p>`,
        },
      ];
      const ctas = [
        { label: "See the plan", url: `${origin}/check` },
        { label: "See what members get", url: `${origin}/pricing` },
        { label: "Check again with today's prices", url: `${origin}/check` },
      ];
      const sent = await sendEmail({
        to: lead.email,
        subject: emails[step].subject,
        cta: ctas[step],
        html: emails[step].html + unsubscribeFooter(origin, "lead", lead.id, "You're getting this because you checked your plan with Utilo."),
      });
      if (sent) {
        dripSent++;
        await supabaseAdmin.from("leads").update({ drip_step: step + 1, drip_sent_at: new Date().toISOString() }).eq("id", lead.id);
      }
    } catch (err) {
      console.error("recheck-prices: drip failed", lead.id, err);
      errors++;
    }
  }

  await sendHealthEmail("daily recheck", {
    "members checked": (subsData ?? []).length,
    "members alerted": subscribersNotified,
    "free users alerted": leadsNotified,
    "follow-up emails sent": dripSent,
    "deal-ending alerts": dealAlerts,
    errors,
  });
  return NextResponse.json({ ok: true, subscribersNotified, leadsNotified, dripSent, dealAlerts, errors });
}

/** Warn this many days before a discount or fixed price ends. */
const DEAL_WARNING_DAYS = 30;

interface DealRow {
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
  reference_total: number | null;
  home_profile: unknown;
  discount_ends_at: string | null;
  current_price_fixed_until: string | null;
  deal_alert_sent_for: string | null;
}

interface DripLeadRow {
  wants_price_alerts?: boolean;
  id: string;
  email: string;
  created_at: string;
  drip_step: number;
  best_retailer: string | null;
  best_plan_name: string | null;
  estimated_saving: number | null;
  billing_days: number | null;
}

/** True when the saved home answers say they charge an EV at home. */
function hasEv(profile: unknown): boolean {
  return !!profile && typeof profile === "object" && (profile as { ev?: unknown }).ev === true;
}

