"use client";

import { useMemo } from "react";
import { explainBill, latestPair } from "@/lib/billChange";
import type { Fuel, TrackedBill } from "@/lib/billTracker";
import s from "./billwhy.module.css";

// 8 Nov 2026: "Why this bill is different". The latest bill against the one
// before, with a dollar figure on each reason: a bar per reason, red where it
// pushed the bill up, green where it brought it down, and what the bill
// itself doesn't say (an estimated read, a rebate gone, a tariff change).

const whole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-AU")}`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

export default function BillWhy({ bills, fuel }: { bills: TrackedBill[] | null; fuel: Fuel }) {
  const why = useMemo(() => {
    const pair = latestPair((bills ?? []).filter((b) => b.fuel === fuel), (b) => (fuel === "gas" ? b.mj : b.kwh));
    return pair ? explainBill(pair[0], pair[1], fuel === "gas" ? "gas" : "power") : null;
  }, [bills, fuel]);
  if (!bills) return null;
  if (!why) {
    // One bill so far: say what's coming, so the second bill has a reason to arrive.
    const n = bills.filter((b) => b.fuel === fuel && b.amount !== null).length;
    return n === 1 ? (
      <div className={`${s.card} ${s.waiting}`}>
        <b>Why your next bill is different</b>
        <span>When your next {fuel === "gas" ? "gas " : ""}bill comes in, we&apos;ll show what changed since this one, in dollars: usage, prices, days, credits.</span>
      </div>
    ) : null;
  }
  const max = Math.max(1, ...why.steps.map((x) => Math.abs(x.dollars)));
  const up = why.diff >= 5, down = why.diff <= -5;
  return (
    <div className={`${s.card} ${fuel === "gas" ? s.gas : ""}`} aria-labelledby={`why-${fuel}`}>
      <p className={s.kicker}>Why this bill is different</p>
      <h4 id={`why-${fuel}`} className={`${s.head} ${up ? s.up : down ? s.down : ""}`}>{why.headline}</h4>
      <p className={s.sentence}>{why.sentence}</p>
      <p className={s.dates}>Bill to {fmtDay(why.nextEnd)} ({whole(why.nextAmount)}) against the one to {fmtDay(why.prevEnd)} ({whole(why.prevAmount)}).</p>
      {why.steps.length > 0 && (
        <ul className={s.bars}>
          {why.steps.slice(0, 5).map((x) => (
            <li key={x.key}>
              <span className={s.label}>{x.label}</span>
              <span className={s.track}><i className={x.dollars > 0 ? s.barUp : s.barDown} style={{ width: `${Math.max(4, (Math.abs(x.dollars) / max) * 100)}%` }} /></span>
              <b className={x.dollars > 0 ? s.valUp : s.valDown}>{x.dollars > 0 ? "+" : "−"}{whole(x.dollars)}</b>
            </li>
          ))}
        </ul>
      )}
      {why.notes.length > 0 && <ul className={s.notes}>{why.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}
