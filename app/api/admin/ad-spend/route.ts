import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { SPEND_CHANNELS } from "@/lib/ownerAnalytics";

// Owner dashboard (9 Nov 2026): record what was spent on ads in a month, per
// channel, so the dashboard can show cost per free check and per member.
// One row per month and channel; saving again replaces it (0 clears it).

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: NextRequest) {
  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) return fail("Please log in to the dashboard again.", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail("Not allowed.", 403);
  if (!supabaseAdmin) return fail("The database isn't connected.", 500);
  const b = await req.json().catch(() => null);
  const month = typeof b?.month === "string" && /^\d{4}-\d{2}$/.test(b.month) ? `${b.month}-01` : null;
  const channel = SPEND_CHANNELS.find((c) => c === b?.channel) ?? null;
  const amount = typeof b?.amount === "number" ? b.amount : Number(b?.amount);
  if (!month) return fail("Pick a month.");
  if (!channel) return fail("Pick a channel.");
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return fail("Enter the amount in dollars.");
  const { error } = await supabaseAdmin.from("ad_spend").upsert({ month, channel, amount: Math.round(amount * 100) / 100 }, { onConflict: "month,channel" });
  if (error) return fail(/does not exist|schema cache/i.test(error.message) ? "Run supabase/schema.sql first (adds the ad_spend table)." : error.message, 500);
  return NextResponse.json({ ok: true });
}
