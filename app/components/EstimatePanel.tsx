"use client";

import { useMemo } from "react";
import { MONTH_NAMES, TYPICAL_ANNUAL_KWH, monthlyEstimate, type HomeProfile } from "@/lib/profileUsage";
import s from "./estimatepanel.module.css";

const n = (x: number) => Math.round(x).toLocaleString("en-AU");

/** The month we're in, in Melbourne time. */
function thisMonth(): number {
  try {
    const m = new Intl.DateTimeFormat("en-AU", { month: "numeric", timeZone: "Australia/Melbourne" }).format(new Date());
    return Math.min(11, Math.max(0, parseInt(m, 10) - 1));
  } catch {
    return new Date().getMonth();
  }
}

/** One-line live total that sits at the top of the questions while they answer. */
export function EstimateStrip({ profile }: { profile: HomeProfile }) {
  const { months, breakdown } = useMemo(() => monthlyEstimate(profile), [profile]);
  const m = thisMonth();
  return (
    <div className={s.strip} role="status" aria-live="polite">
      <span className={s.stripDot} aria-hidden="true" />
      <span>
        Your estimate: <b>{n(breakdown.total)} kWh a year</b>
        <span className={s.stripSep}> · </span>
        about <b>{n(months[m].kwh)} kWh</b> in {MONTH_NAMES[m]}
      </span>
    </div>
  );
}

/**
 * What we think the home uses, and why: the year by category, each month as
 * a bar (this month highlighted), and how it compares with a typical home.
 */
export default function EstimatePanel({ profile, billDays }: { profile: HomeProfile; billDays: number }) {
  const { months, breakdown: b } = useMemo(() => monthlyEstimate(profile), [profile]);
  const m = thisMonth();
  const max = Math.max(...months.map((x) => x.kwh), 1);
  const perBill = (b.total * billDays) / 365;
  const rows: [string, string, number][] = [
    ["Everyday use", "Lights, fridge, cooking, laundry, screens", b.everyday],
    ["Hot water", profile.hotWater === "heat_pump" ? "Heat pump, for the people in your home" : "Electric, for the people in your home", b.hotWater],
    ["Heating", profile.heating === "resistive" ? "Electric heaters, mostly May to September" : "Split system, mostly May to September", b.heating],
    ["Cooling", "Air-con, mostly December to March", b.cooling],
    ["Pool or spa", "Pump and heating, more in summer", b.pool],
    ["Electric car", "About 12,000 km a year", b.ev],
  ];
  const shown = rows.filter(([label, , v]) => v > 0 || label === "Everyday use");
  const biggest = Math.max(...shown.map(([, , v]) => v), b.solarSelfUse, 1);
  const vsTypical = b.total / TYPICAL_ANNUAL_KWH - 1;

  return (
    <div className={s.panel}>
      <div className={s.top}>
        <div>
          <span className={s.kicker}>Your estimate</span>
          <p className={s.big}>{n(b.total)} <small>kWh a year</small></p>
          <p className={s.sub}>
            About {(b.total / 365).toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh a day · about <b>{n(months[m].kwh)} kWh in {MONTH_NAMES[m]}</b> · ~{n(perBill)} kWh a bill
          </p>
        </div>
        <div className={s.vs}>
          <span>Typical Victorian home</span>
          <b>{n(TYPICAL_ANNUAL_KWH)} kWh</b>
          <em className={vsTypical > 0.1 ? s.up : vsTypical < -0.1 ? s.down : s.flat}>
            {Math.abs(vsTypical) <= 0.1 ? "About the same" : `${Math.round(Math.abs(vsTypical) * 100)}% ${vsTypical > 0 ? "more" : "less"}`}
          </em>
        </div>
      </div>

      <div className={s.months} aria-label="Estimated use by month">
        {months.map((x) => (
          <div key={x.month} className={`${s.month} ${x.month === m ? s.now : ""}`} title={`${MONTH_NAMES[x.month]}: about ${n(x.kwh)} kWh`}>
            <span className={s.col}>
              <span className={s.bar} style={{ height: `${Math.max(4, Math.round((x.kwh / max) * 100))}%` }}>
                {x.month === m && <span className={s.val}>{n(x.kwh)}</span>}
              </span>
            </span>
            <span className={s.lab}>{MONTH_NAMES[x.month][0]}</span>
          </div>
        ))}
      </div>

      <div className={s.parts}>
        <span className={s.partsHead}>How we got there (kWh a year)</span>
        {shown.map(([label, hint, v]) => (
          <div key={label} className={s.part}>
            <span className={s.partName}><b>{label}</b><small>{hint}</small></span>
            <span className={s.partTrack}><span style={{ width: `${Math.round((v / biggest) * 100)}%` }} /></span>
            <b className={s.partVal}>{n(v)}</b>
          </div>
        ))}
        {b.solarSelfUse > 0 && (
          <div className={`${s.part} ${s.partSolar}`}>
            <span className={s.partName}><b>Solar used at home</b><small>Daytime use your panels cover. You export about {n(b.solarExport)} more.</small></span>
            <span className={s.partTrack}><span style={{ width: `${Math.round((b.solarSelfUse / biggest) * 100)}%` }} /></span>
            <b className={s.partVal}>−{n(b.solarSelfUse)}</b>
          </div>
        )}
      </div>

      <p className={s.note}>
        Built from published averages for Melbourne homes (AER and ESC), adjusted for your answers. Plans are compared on your average across the
        year, so winter and summer both count. A bill gives the real number.
      </p>
    </div>
  );
}
