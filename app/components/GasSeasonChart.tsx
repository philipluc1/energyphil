"use client";

import { useId } from "react";
import s from "./gasseason.module.css";

// A year of gas, month by month: the winter heating hump over the flat hot
// water and cooking base. Shown with the estimate (so people see why a winter
// bill is scary) and on the dashboard with the member's own figures.

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function GasSeasonChart({
  heating,
  other,
  highlight = [],
  title = "Your gas through the year",
  note,
}: {
  /** MJ per month, Jan..Dec. */
  heating: number[];
  other: number[];
  /** Months (0..11) the bill covered, drawn brighter. */
  highlight?: number[];
  title?: string;
  note?: string;
}) {
  const id = useId();
  const totals = heating.map((h, i) => h + (other[i] ?? 0));
  const max = Math.max(1, ...totals);
  const annual = totals.reduce((a, b) => a + b, 0);
  const winter = totals[4] + totals[5] + totals[6] + totals[7]; // May-Aug
  const summer = totals[11] + totals[0] + totals[1] + totals[2]; // Dec-Mar
  const peakM = totals.indexOf(Math.max(...totals));
  const hl = new Set(highlight);
  const gj = (mj: number) => (mj / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 });
  return (
    <section className={s.wrap} aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className={s.title}>{title}</h3>
      <div className={s.legend}>
        <span><i className={s.swHeat} /> Heating</span>
        <span><i className={s.swBase} /> Hot water and cooking</span>
        {highlight.length > 0 && <span><i className={s.swBill} /> Months on your bill</span>}
      </div>
      <div className={s.chart} role="img" aria-label={`About ${gj(annual)} GJ a year, peaking in ${MONTH_LONG[peakM]}. Winter months use about ${winter > 0 && summer > 0 ? Math.round(winter / summer) : "-"} times the gas of summer months.`}>
        {totals.map((t, i) => (
          <div key={i} className={`${s.col} ${hl.has(i) ? s.colOn : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <div className={s.bar} style={{ height: `${(t / max) * 100}%` }}>
              <span className={s.segHeat} style={{ flexGrow: heating[i] }} />
              <span className={s.segBase} style={{ flexGrow: other[i] ?? 0 }} />
            </div>
            <span className={s.lab}>{MONTHS[i]}</span>
          </div>
        ))}
      </div>
      <div className={s.stats}>
        <div><b>{gj(annual)} GJ</b><span>a year, about {Math.round(annual / 365).toLocaleString("en-AU")} MJ a day</span></div>
        <div><b>{MONTH_LONG[peakM]}</b><span>busiest month</span></div>
        {winter > 0 && summer > 0 && <div><b>{(winter / summer).toLocaleString("en-AU", { maximumFractionDigits: 1 })}×</b><span>winter vs summer</span></div>}
      </div>
      {note && <p className={s.note}>{note}</p>}
    </section>
  );
}
