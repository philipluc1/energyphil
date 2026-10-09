"use client";

import { useMemo, useState } from "react";
import { rankPlans, type Distributor, type UsageInput } from "@/lib/plans";
import { vdoBillForUsage } from "@/lib/profileUsage";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import ResultsChart, { type ChartItem } from "./ResultsChart";
import FunEquivalents from "./FunEquivalents";
import styles from "./memberresult.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PERIOD_DAYS = { month: 365 / 12, quarter: 365 / 4, year: 365 } as const;
const PERIOD_LABEL = { month: "a month", quarter: "a quarter", year: "a year" } as const;

/** A member's live comparison, priced from the usage on file against today's
 *  plan data, with the same period toggle and chart as the public check. */
export default function MemberResult({
  distributor, days, peak, shoulder, offpeak, anytime, cl, solarExportKwh, referenceTotal, source,
}: {
  distributor: Distributor; days: number; peak: number; shoulder: number; offpeak: number; anytime: number; cl: number;
  solarExportKwh: number; referenceTotal: number | null; source: "bill" | "answers";
}) {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("year");
  const usage: UsageInput = useMemo(() => ({ days, peak, shoulder, offpeak, anytime, cl, solarExportKwh }), [days, peak, shoulder, offpeak, anytime, cl, solarExportKwh]);
  const matches = useMemo(() => rankPlans(distributor, usage), [distributor, usage]);
  const top = matches[0];
  if (!top || days <= 0) return null;
  const haveBill = referenceTotal !== null && referenceTotal > 0;
  const bench = haveBill ? (referenceTotal as number) : vdoBillForUsage(distributor, usage);
  const k = PERIOD_DAYS[period] / days;
  const saving = bench - top.total;
  const verdict = haveBill ? (saving <= 1 ? "good" : "bad") : "estimate";
  const items: ChartItem[] = [
    ...matches.slice(0, 5).map((m, i) => ({ label: m.plan[0], sublabel: m.plan[2], value: m.total * k, kind: (i === 0 ? "cheapest" : "plan") as ChartItem["kind"] })),
    { label: haveBill ? "Your bill" : "Default offer (VDO)", sublabel: haveBill ? "What you pay now" : `VDO for ${distributor}`, value: bench * k, kind: haveBill ? (saving <= 1 ? "referenceGood" : "referenceBad") : "reference" },
  ];
  return (
    <div className={`${styles.card} ${styles[verdict]}`}>
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>{verdict === "good" ? "You're on a good deal" : verdict === "bad" ? "Yes, you'd save with" : "Cheapest for your usage"}</span>
          <div className={styles.retailer}>{top.plan[0]}</div>
          <div className={styles.plan}>{top.plan[2]}</div>
        </div>
        <div className={styles.toggle} role="tablist">
          {(["month", "quarter", "year"] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? styles.on : styles.btn} onClick={() => setPeriod(p)}>
              {p === "month" ? "Monthly" : p === "quarter" ? "Quarterly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.nums}>
        <div className={styles.tile}><b>{money(top.total * k)}</b><span>{PERIOD_LABEL[period]} on this plan</span></div>
        <div className={`${styles.tile} ${styles.tileSave}`}><b>{money(Math.abs(saving) * k)}</b><span>{saving >= 0 ? "you'd save" : "extra"} {PERIOD_LABEL[period]} vs {haveBill ? "your bill" : "the default offer"}</span></div>
        <div className={styles.tile}><b>{bench > 0 ? `${Math.round(Math.abs(saving / bench) * 100)}%` : "—"}</b><span>{saving >= 0 ? "cheaper" : "dearer"}</span></div>
      </div>
      {verdict === "bad" && <FunEquivalents dollars={(saving / days) * 365} />}
      <div className={styles.chart}><ResultsChart items={items} /></div>
      <p className={styles.note}>
        Priced today from {source === "bill" ? "your last bill" : "your answers"} ({days}-day period, scaled to {PERIOD_LABEL[period]}). We re-run this every morning and email you only when a move is worth it.
      </p>
      {RETAILER_LINKS[top.plan[0]] && (
        <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.go}>Go to {top.plan[0]} →</a>
      )}
    </div>
  );
}
