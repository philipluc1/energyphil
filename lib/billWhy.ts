import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { billRowFrom, type BillRow } from "./billRows";
import { explainBill, type BillExplanation } from "./billChange";
import type { BillDetail } from "./billTracker";

/**
 * "Why this bill went up" for a bill that's just been read (8 Nov 2026): each
 * fuel on it against the member's previous bill of that fuel. Empty when
 * there's no earlier bill to compare with. Never throws.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function whyForBill(email: string, bill: any): Promise<{ fuel: "electricity" | "gas"; why: BillExplanation }[]> {
  if (!supabaseAdmin) return [];
  try {
    const rows = billRowFrom(bill, email, new Date().toISOString().slice(0, 10));
    const out: { fuel: "electricity" | "gas"; why: BillExplanation }[] = [];
    for (const next of rows) {
      const prev = await previousBill(email, next);
      if (!prev) continue;
      const usageOf = (r: { kwh: number | null; mj: number | null }) => Number(next.fuel === "gas" ? r.mj : r.kwh);
      const why = explainBill(
        { periodEnd: prev.period_end, days: prev.billing_days, amount: Number(prev.amount), usage: usageOf(prev), detail: prev.detail ?? null },
        { periodEnd: next.period_end, days: next.billing_days, amount: Number(next.amount), usage: usageOf(next), detail: next.detail ?? null },
        next.fuel === "gas" ? "gas" : "power",
      );
      if (why) out.push({ fuel: next.fuel, why });
    }
    return out;
  } catch (err) {
    console.warn("billWhy: skipped", err);
    return [];
  }
}

type Prev = { period_end: string; billing_days: number; amount: number | null; kwh: number | null; mj: number | null; detail?: BillDetail | null };

async function previousBill(email: string, next: BillRow): Promise<Prev | null> {
  const q = (cols: string) => supabaseAdmin!
    .from("bills").select(cols)
    .eq("email", email).eq("fuel", next.fuel)
    .lt("period_end", next.period_end)
    .not("amount", "is", null)
    .order("period_end", { ascending: false }).limit(1).maybeSingle();
  let { data, error } = await q("period_end, billing_days, amount, kwh, mj, detail");
  if (error && /detail/.test(error.message)) ({ data, error } = await q("period_end, billing_days, amount, kwh, mj"));
  if (error || !data) return null;
  const p = data as unknown as Prev;
  // A bill more than ~4 months before this one's start isn't "the last bill".
  const gap = (Date.parse(next.period_end) - Date.parse(p.period_end)) / 86_400_000 - next.billing_days;
  return gap > 120 ? null : p;
}
