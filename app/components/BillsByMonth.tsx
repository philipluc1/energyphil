"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackMonths, type Fuel, type TrackedBill } from "@/lib/billTracker";
import { MONTH_NAMES } from "@/lib/profileUsage";
import s from "./billsbymonth.module.css";

// 8 Nov 2026: the member's own bills on the plain-English card. The date
// range of the bill being explained, and $ by month from every bill they've
// uploaded or forwarded (spread by day, like the tracker on Savings).

const DAY = 86_400_000;
const fmt = (iso: string, withYear: boolean) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
const money0 = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

export function useMemberBills(fuel: Fuel): TrackedBill[] | null {
  const [bills, setBills] = useState<TrackedBill[] | null>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      if (!supabase) { setBills([]); return; }
      const { data, error } = await supabase.from("bills").select("id, fuel, period_end, billing_days, kwh, mj, amount, retailer, source").eq("fuel", fuel).order("period_end", { ascending: true });
      if (!on) return;
      if (error) { setBills([]); return; }
      setBills(((data ?? []) as TrackedBill[]).map((b) => ({ ...b, kwh: b.kwh === null ? null : Number(b.kwh), mj: b.mj === null ? null : Number(b.mj), amount: b.amount === null ? null : Number(b.amount) })));
    })();
    return () => { on = false; };
  }, [fuel]);
  return bills;
}

/** "5 Oct – 7 Nov 2026" for the latest bill of this fuel, or nothing until we know. */
export function billPeriod(bills: TrackedBill[] | null): string | null {
  const last = bills?.filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.period_end) && b.billing_days > 0).at(-1);
  if (!last) return null;
  const end = Date.parse(`${last.period_end}T00:00:00Z`);
  const start = new Date(end - (last.billing_days - 1) * DAY).toISOString().slice(0, 10);
  const sameYear = start.slice(0, 4) === last.period_end.slice(0, 4);
  return `${fmt(start, !sameYear)} – ${fmt(last.period_end, true)}`;
}

export function BillPeriod({ fuel }: { fuel: Fuel }) {
  const bills = useMemberBills(fuel);
  const p = billPeriod(bills);
  return p ? <>{p} · </> : null;
}

/** $ by month from the bills on file, last 12 months. */
export default function BillsByMonth({ fuel }: { fuel: Fuel }) {
  const bills = useMemberBills(fuel);
  const months = useMemo(() => (bills && bills.length ? trackMonths(bills, fuel, { minMonths: 6, maxMonths: 12 }) : []), [bills, fuel]);
  if (!bills || !bills.length || !months.length) return null;
  const max = Math.max(1, ...months.map((m) => m.amount));
  const billed = months.filter((m) => m.status === "full" || m.status === "part");
  const perMonth = billed.length ? billed.reduce((a, m) => a + m.amount, 0) / billed.length : 0;
  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <b>Your {fuel === "gas" ? "gas" : "power"} bills by month</b>
        <span>{bills.length} bill{bills.length === 1 ? "" : "s"} on file · about {money0(perMonth)} a month</span>
      </div>
      <div className={s.bars} role="img" aria-label={months.map((m) => `${MONTH_NAMES[m.month]}: ${m.status === "missing" ? "no bill" : money0(m.amount)}`).join(", ")}>
        {months.map((m) => (
          <div key={m.key} className={`${s.col} ${s[m.status]}`} title={`${MONTH_NAMES[m.month]} ${m.year}: ${m.status === "missing" ? "no bill" : m.status === "now" ? "this month, not billed yet" : money0(m.amount) + (m.status === "part" ? " (part of the month)" : "")}`}>
            <span className={s.amt}>{m.status === "full" || m.status === "part" ? money0(m.amount) : ""}</span>
            <span className={s.bar} style={{ height: `${Math.max(4, Math.round((m.amount / max) * 56))}px` }} />
            <span className={s.lab}>{MONTH_NAMES[m.month].slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <p className={s.fine}>From the bills you&apos;ve uploaded or forwarded, spread across the days each one covers. Striped months are only partly covered; grey ones have no bill yet.</p>
    </div>
  );
}
