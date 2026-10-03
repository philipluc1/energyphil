import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { computeBest, isMeaningfullyCheaper, fmtCurrency } from "@/lib/priceWatch";
import type { Distributor } from "@/lib/plans";

// Vercel Cron (see vercel.json) hits this once a day. It re-prices every
// saved profile against today's lib/plans.ts data and emails anyone for whom
// something cheaper has turned up since we last told them. It only finds
// NEW plans when lib/plans.ts itself has been refreshed (see README "Photo
// bill reading" / plan data section) — this job doesn't pull fresh market
// data on its own, it just re-runs the comparison whenever it's called.
export const maxDuration = 60;

interface SubscriberWatchRow {
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
  baseline_total: number | null;
  last_notified_total: number | null;
}

interface LeadWatchRow {
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
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

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
      "id, email, status, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, baseline_total, last_notified_total",
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
      });
      if (!best) continue;

      const previousBest = sub.last_notified_total ?? sub.baseline_total;
      if (!isMeaningfullyCheaper(best.bestTotal, previousBest)) continue;

      const sent = await sendEmail({
        to: sub.email,
        subject: "A cheaper electricity plan just showed up for you",
        html: `
          <p>Good news — while keeping an eye on the market for you, we found a plan that's now cheaper than what you were last on:</p>
          <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">${best.bestRetailer} — ${best.bestPlanName}</p>
          <p style="margin:0 0 16px;">Estimated <strong>${fmtCurrency(previousBest! - best.bestTotal)}</strong> cheaper than your last checked plan, for the same billing period.</p>
          <p><a href="${origin}/check">See the full comparison and how to switch →</a></p>
          ${unsubscribeFooter(
            origin,
            "subscriber",
            sub.id,
            "You're getting this because you're subscribed to VIC Energy Check's ongoing monitoring. This link won't cancel your plan — contact us for that.",
          )}
        `,
      });

      if (sent) {
        subscribersNotified++;
        await supabaseAdmin
          .from("subscribers")
          .update({
            last_notified_total: best.bestTotal,
            last_notified_retailer: best.bestRetailer,
            last_notified_plan_name: best.bestPlanName,
            last_notified_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
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
      "id, email, distributor, billing_days, peak_kwh, shoulder_kwh, offpeak_kwh, anytime_kwh, controlled_load_kwh, best_retailer, best_total, last_notified_total",
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
      });
      if (!best) continue;

      const previousBest = lead.last_notified_total ?? lead.best_total;
      if (!isMeaningfullyCheaper(best.bestTotal, previousBest)) continue;

      const sent = await sendEmail({
        to: lead.email,
        subject: "A cheaper electricity plan just showed up in your area",
        html: `
          <p>When you checked your bill with VIC Energy Check, the best match was ${lead.best_retailer ?? "your previous result"}. We just found something cheaper:</p>
          <p style="font-size:18px;font-weight:700;margin:16px 0 4px;">${best.bestRetailer} — ${best.bestPlanName}</p>
          <p style="margin:0 0 16px;">Estimated <strong>${fmtCurrency(previousBest! - best.bestTotal)}</strong> cheaper, for the same billing period.</p>
          <p><a href="${origin}/check">See it and switch →</a></p>
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

  return NextResponse.json({ ok: true, subscribersNotified, leadsNotified, errors });
}
