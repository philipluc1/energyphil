"use client";

import RetailerLogo from "./RetailerLogo";
import { dailyChanges, type MarketEvent } from "@/lib/marketActivity";
import styles from "./dashcompare.module.css";

// "Changes by day" on the market pages (electricity and gas): one bar a day,
// new offers in teal and updated ones in amber, with the logos of the
// retailers behind that day's changes sitting on top of the bar.

const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

export default function DayChanges({ events, label = "" }: { events: MarketEvent[]; label?: string }) {
  const days = dailyChanges(events, 30);
  const dayMax = Math.max(...days.map((d) => d.newOffers + d.priceChanges), 1);
  // Retailers per day, busiest first.
  const who = new Map<string, Map<string, number>>();
  for (const e of events) {
    const m = who.get(e.date) ?? new Map<string, number>();
    m.set(e.retailer, (m.get(e.retailer) ?? 0) + 1);
    who.set(e.date, m);
  }
  const names = (iso: string) => [...(who.get(iso)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  // Bars top out below the full height so the logos have room above them.
  const H = 68;
  return (
    <>
      <div className={styles.mdChart} role="img" aria-label={`${events.length} ${label}offer changes over 30 days`}>
        {days.map((d) => {
          const t = d.newOffers + d.priceChanges;
          const rs = names(d.date);
          // Two logos fit; a third and more become "+N".
          const shown = rs.length > 2 ? rs.slice(0, 1) : rs;
          return (
            <span key={d.date} className={styles.mdCol} title={`${shortDay(d.date)}: ${d.newOffers} new, ${d.priceChanges} updated${rs.length ? ` (${rs.join(", ")})` : ""}`}>
              <i className={styles.mdPrice} style={{ height: `${(d.priceChanges / dayMax) * H}%` }} />
              <i className={styles.mdNew} style={{ height: `${(d.newOffers / dayMax) * H}%` }} />
              {t === 0 && <i className={styles.mdZero} />}
              {rs.length > 0 && (
                <span className={styles.mdLogos} aria-hidden="true">
                  {shown.map((r) => <RetailerLogo key={r} name={r} size={26} square />)}
                  {rs.length > shown.length && <em>+{rs.length - shown.length}</em>}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className={styles.mdAxis}><span>{shortDay(days[0].date)}</span><span>Today</span></div>
      <div className={styles.mdLegend}><span><i className={styles.mdNew} /> New offer</span><span><i className={styles.mdPrice} /> Updated offer</span></div>
    </>
  );
}
