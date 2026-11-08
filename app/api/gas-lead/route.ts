import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GAS_ZONES, gasBenchmark, rankGasPlans, type GasZone } from "@/lib/gasPlans";
import { topOpen } from "@/lib/plans";
import { resultEmail } from "@/lib/emailTemplates";
import { billLesson } from "@/lib/billLesson";
import { emailConfigured, sendEmail } from "@/lib/email";
import { SRC_COOKIE, sourceValue } from "@/lib/attribution";

// The gas check's email step (9 Nov 2026): saves the lead and emails the gas
// result. Like /api/lead, the result is worked out here from the usage, never
// trusted from the browser. Follow-ups only to people who ticked the box.

const num = (v: unknown, max: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const EMAIL = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}$/i;

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Saving isn't switched on yet." }, { status: 503 });
  const b = await req.json().catch(() => null);
  const email = str(b?.email, 200)?.toLowerCase() ?? "";
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, message: "Please check your email address." }, { status: 400 });
  const zone = (GAS_ZONES as readonly string[]).includes(b?.zone) ? (b.zone as GasZone) : null;
  const days = Math.round(num(b?.days, 366));
  const mj = num(b?.mj, 500_000);
  if (!zone || days < 1 || mj <= 0) return NextResponse.json({ ok: false, message: "Missing your gas network or usage." }, { status: 400 });

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: false, message: "We've already saved this. Check your inbox." }, { status: 429 });

  const usage = { days, mj };
  const bill = num(b?.bill, 20000);
  const currentRetailer = str(b?.currentRetailer, 80);
  const top = topOpen(rankGasPlans(zone, usage, currentRetailer)) ?? null;
  const bench = gasBenchmark(zone, usage, bill > 0 ? bill : null);
  const save = top && bench ? bench.value - top.total : null;
  const wantsAlerts = b?.wantsAlerts === true;
  const row = {
    email, distributor: zone, billing_days: days, usage_mode: "gas",
    current_bill: bill > 0 ? bill : null,
    best_retailer: top?.plan[0] ?? null, best_plan_name: top?.plan[2] ?? null, best_total: top?.total ?? null,
    estimated_saving: save, estimated_saving_pct: save !== null && bench && bench.value > 0 ? save / bench.value : null,
    wants_price_alerts: wantsAlerts,
    // The day-1 resend is for power results; gas leads go straight to the follow-ups (if they opted in).
    drip_step: wantsAlerts ? 1 : 3,
  };
  const source = sourceValue(req.cookies.get(SRC_COOKIE)?.value);
  const withSource: Record<string, unknown> = source ? { ...row, source } : row;
  let { data: inserted, error } = await supabaseAdmin.from("leads").insert(withSource).select("id").single();
  if (error && source && /source|schema cache/i.test(error.message)) ({ data: inserted, error } = await supabaseAdmin.from("leads").insert(row).select("id").single());
  if (error) {
    console.error("gas lead insert failed", error.message);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Please try again." }, { status: 500 });
  }
  let emailed = false;
  if (emailConfigured && inserted && top && bench) {
    const origin = process.env.SITE_URL || req.nextUrl.origin;
    const perYear = 365 / days;
    const e = resultEmail({
      origin, gas: true,
      retailer: top.plan[0], planName: top.plan[2],
      yearly: Math.max(0, (save ?? 0) * perYear),
      vsBill: bill > 0,
      unsubscribeUrl: `${origin}/api/unsubscribe?type=lead&id=${inserted.id}`,
      nowYear: bench.value * perYear, bestYear: top.total * perYear,
      usageLine: `${Math.round(mj).toLocaleString("en-AU")} MJ of gas over ${days} days`,
      network: zone, currentRetailer,
      lesson: billLesson({ fuel: "gas", days, usage: mj, total: bill > 0 ? bill : null, supplyPerDay: num(b?.supplyCentsPerDay, 500) / 100 || null, estimated: b?.estimated === true, fees: [], discountLost: false })?.text ?? null,
    });
    emailed = await sendEmail({ to: email, subject: e.subject, title: e.title, html: e.html }).catch(() => false);
  }
  return NextResponse.json({ ok: true, emailed });
}
