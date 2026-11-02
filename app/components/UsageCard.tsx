"use client";

import { useMemo } from "react";
import UsageShape from "./UsageShape";
import { compute, type ComparisonInput } from "./DashboardComparison";
import { forecastYear } from "@/lib/homeInsights";
import { MONTH_NAMES, type HomeProfile } from "@/lib/profileUsage";
import type { UsageShapeKey } from "@/lib/usageShape";
import s from "./usagecard.module.css";

const n0 = (n: number) => Math.round(n).toLocaleString("en-AU");

/**
 * Usage in My home, as two cards (2 Nov 2026, was one card with a toggle):
 * "Through a day" on top (today, live, with the weather), then "Year ahead"
 * (the bill's numbers and month by month, with winter and summer).
 */
export default function UsageCard({
  input,
  profile,
  shape,
  exportPerDay,
  evOvernight,
  fromAnswers,
  place = null,
}: {
  input: ComparisonInput;
  profile: HomeProfile | null;
  shape: UsageShapeKey;
  exportPerDay: number;
  evOvernight: boolean;
  fromAnswers: boolean;
  /** Their suburb, for today's weather on the day chart. */
  place?: string | null;
}) {
  const data = useMemo(() => {
    const c = compute(input);
    if (!c) return null;
    const zero = () => 0;
    const f = forecastYear({ base: c.usage, profile, now: zero, best: zero });
    const kwh = c.usage.peak + c.usage.shoulder + c.usage.offpeak + c.usage.anytime + c.usage.cl;
    return { kwh, days: c.usage.days, perDay: c.usage.days > 0 ? kwh / c.usage.days : 0, f };
  }, [input, profile]);
  if (!data) return null;
  const { f } = data;
  const year = f ? f.months.reduce((a, m) => a + m.kwh, 0) : data.perDay * 365;
  const max = f ? Math.max(...f.months.map((m) => m.kwh), 1) : 1;
  const peak = f ? f.months.reduce((a, m) => (m.kwh / m.days > a.kwh / a.days ? m : a), f.months[0]) : null;

  const dayChart = (
    <section className={s.card} aria-labelledby="usage-day-title">
      <div className={s.head}>
        <h3 id="usage-day-title">Through a day</h3>
        <span className={s.headNote}>Today, as it happens</span>
      </div>
      <div className={s.dayBody}>
        <UsageShape
          shape={shape}
          dailyKwh={data.perDay}
          exportKwhPerDay={exportPerDay}
          evOvernight={evOvernight}
          live
          bare
          place={place}
          note={`Modelled from ${fromAnswers ? "your answers" : "your bill's usage and the typical pattern for a home like yours"}, not your meter. It decides whether a time-of-use plan beats a single rate for you: the dearer window is shaded.`}
        />
      </div>
    </section>
  );

  return (
    <>
      {dayChart}
      <section className={s.card} aria-labelledby="usage-year-title">
        <div className={s.head}>
          <h3 id="usage-year-title">Year ahead</h3>
        </div>
        <div className={s.stats}>
          <div><b>{n0(data.kwh)} kWh</b><span>{fromAnswers ? "estimated" : "last bill"} ({n0(data.days)} days)</span></div>
          <div><b>{data.perDay.toFixed(1)} kWh</b><span>a day</span></div>
          <div className={s.statYear}><b>{n0(year)} kWh</b><span>forecast, next 12 months</span></div>
        </div>
        {f ? (
          <>
            <div className={s.bars} role="img" aria-label={`Forecast kWh for each of the next 12 months; busiest is ${peak ? MONTH_NAMES[peak.month] : ""}`}>
              {f.months.map((m, i) => (
                <div key={`${m.year}-${m.month}`} className={s.bar}>
                  <span className={s.barVal}>{n0(m.kwh)}</span>
                  <span className={`${s.barFill} ${i === 0 ? s.barNow : ""} ${peak && m === peak ? s.barPeak : ""}`} style={{ height: `${Math.max(6, (m.kwh / max) * 100)}%` }} />
                  <span className={s.barMonth}>{MONTH_NAMES[m.month].slice(0, 1)}<span className={s.barMonthLong}>{MONTH_NAMES[m.month].slice(1, 3)}</span></span>
                </div>
              ))}
            </div>
            <p className={s.note}>
              {peak ? <>Busiest: <b>{MONTH_NAMES[peak.month]}</b>, about {n0(peak.kwh)} kWh. </> : null}
              {f.seasonal
                ? "Your bill sets how much you use; your answers set how it moves through the year (heating in winter, cooling in summer)."
                : "From your bill's daily average. Answer a few questions about your home and we'll add winter and summer."}
            </p>
          </>
        ) : (
          <p className={s.note}>From your bill&apos;s daily average. Answer a few questions about your home and we&apos;ll add winter and summer.</p>
        )}
      </section>
    </>
  );
}
