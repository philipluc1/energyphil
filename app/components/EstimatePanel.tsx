"use client";

import { useMemo } from "react";
import { MONTH_NAMES, TYPICAL_ANNUAL_KWH, monthlyEstimate, type BillForecast, type HomeProfile } from "@/lib/profileUsage";
import Icon from "./Icon";
import s from "./estimatepanel.module.css";

const n = (x: number) => Math.round(x).toLocaleString("en-AU");

/** The month we're in, in Melbourne time. */
export function thisMonth(): number {
  try {
    const m = new Intl.DateTimeFormat("en-AU", { month: "numeric", timeZone: "Australia/Melbourne" }).format(new Date());
    return Math.min(11, Math.max(0, parseInt(m, 10) - 1));
  } catch {
    return new Date().getMonth();
  }
}

/** The last 12 full months, most recent first: [month index, "September 2026"]. */
function recentMonths(): [number, string][] {
  const now = new Date();
  const m0 = thisMonth();
  const y0 = now.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const k = m0 - 1 - i;
    const month = ((k % 12) + 12) % 12;
    const year = y0 + Math.floor(k / 12);
    return [month, `${MONTH_NAMES[month]} ${year}`];
  });
}

/** One-line live total that sits at the top of the questions while they answer. */
export function EstimateStrip({ profile, forecast }: { profile: HomeProfile; forecast?: BillForecast | null }) {
  const { months, breakdown } = useMemo(() => monthlyEstimate(profile), [profile]);
  const m = thisMonth();
  const year = forecast ? forecast.annual : breakdown.total;
  const month = forecast ? forecast.months[m].kwh : months[m].kwh;
  return (
    <div className={s.strip} role="status" aria-live="polite">
      <span className={s.stripDot} aria-hidden="true" />
      <span>
        {forecast ? "Forecast from your bill" : "Your estimate"}: <b>{n(year)} kWh a year</b>
        <span className={s.stripSep}> · </span>
        about <b>{n(month)} kWh</b> in {MONTH_NAMES[m]}
      </span>
    </div>
  );
}

export interface BillKwhInput {
  kwhRaw: string;
  endMonth: number;
  onKwh: (raw: string) => void;
  onEndMonth: (month: number) => void;
  /** The forecast once a kWh figure is in, else null. */
  forecast: BillForecast | null;
}

/**
 * What we think the home uses, and why: the year by category, each month as
 * a bar (this month highlighted), and how it compares with a typical home.
 * With a bill's kWh, the same shape is scaled to the bill and becomes a
 * 12-month forecast.
 */
export default function EstimatePanel({ profile, billDays, bill }: { profile: HomeProfile; billDays: number; bill?: BillKwhInput }) {
  const { months: modelMonths, breakdown: b } = useMemo(() => monthlyEstimate(profile), [profile]);
  const fc = bill?.forecast ?? null;
  const months = fc ? fc.months : modelMonths;
  const total = fc ? fc.annual : b.total;
  const m = thisMonth();
  const max = Math.max(...months.map((x) => x.kwh), 1);
  const perBill = (total * billDays) / 365;
  const rows: [string, string, number][] = [
    ["Everyday use", "Lights, fridge, cooking, laundry, screens", b.everyday],
    ["Hot water", profile.hotWater === "heat_pump" ? "Heat pump, for the people in your home" : "Electric, for the people in your home", b.hotWater],
    ["Heating", profile.heating === "resistive" ? "Electric heaters, mostly May to September" : "Split system, mostly May to September", b.heating],
    ["Cooling", "Air-con, mostly December to March", b.cooling],
    ["Pool or spa", "Pump and heating, more in summer", b.pool],
    ["Electric car", "About 12,000 km a year", b.ev],
  ];
  const shown = rows.filter(([label, , v]) => v > 0 || label === "Everyday use");
  const adjust = fc ? fc.annual - b.total : 0;
  const biggest = Math.max(...shown.map(([, , v]) => v), b.solarSelfUse, Math.abs(adjust), 1);
  const vsTypical = total / TYPICAL_ANNUAL_KWH - 1;
  const options = useMemo(() => recentMonths(), []);
  const endLabel = options.find(([mm]) => mm === bill?.endMonth)?.[1] ?? (bill ? MONTH_NAMES[bill.endMonth] : "");
  const pctOff = fc ? Math.round((fc.factor - 1) * 100) : 0;

  return (
    <div className={s.panel}>
      {bill && (
        <div className={`${s.cal} ${fc ? s.calOn : ""}`}>
          <div className={s.calHead}>
            <span className={s.calIcon} aria-hidden="true"><Icon name="receipt" size={18} /></span>
            <span>
              <b>Know your kWh from a recent bill?</b> Add it and we&apos;ll forecast your next 12 months from it, season by season.
            </span>
          </div>
          <div className={s.calRow}>
            <label className={s.calKwh}>
              <span className={s.srOnly}>kWh on the bill</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="e.g. 1,150"
                value={bill.kwhRaw}
                onChange={(e) => bill.onKwh(e.target.value)}
              />
              <span>kWh</span>
            </label>
            <span className={s.calWords}>
              over <b>{billDays} days</b>, ending
            </span>
            <label className={s.calMonth}>
              <span className={s.srOnly}>Month the bill ended</span>
              <select value={bill.endMonth} onChange={(e) => bill.onEndMonth(parseInt(e.target.value, 10))}>
                {options.map(([mm, label]) => <option key={label} value={mm}>{label}</option>)}
              </select>
            </label>
            {bill.kwhRaw && (
              <button type="button" className={s.calClear} onClick={() => bill.onKwh("")}>Clear</button>
            )}
          </div>
          <small className={s.calHint}>
            Add up the usage lines (peak, shoulder, off-peak and controlled load). Change the bill length in question 1 if yours isn&apos;t {billDays} days.
          </small>
        </div>
      )}

      <div className={s.top}>
        <div>
          <span className={s.kicker}>{fc ? "Your 12-month forecast" : "Your estimate"}</span>
          <p className={s.big}>{n(total)} <small>kWh a year</small></p>
          <p className={s.sub}>
            About {(total / 365).toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh a day · about <b>{n(months[m].kwh)} kWh in {MONTH_NAMES[m]}</b> · ~{n(perBill)} kWh a bill
          </p>
          {fc && (
            <p className={s.fcNote}>
              Your bill: <b>{n(parseFloat(bill!.kwhRaw))} kWh</b> to the end of {endLabel}. Your answers alone said {n(fc.modelKwh)} for those days
              {Math.abs(pctOff) < 3 ? ", so they were spot on." : `, so you use about ${Math.abs(pctOff)}% ${pctOff > 0 ? "more" : "less"}. We've scaled every month to match.`}
              {(fc.factor >= 5 || fc.factor <= 0.2) && " That's a long way off, so check the kWh and the bill length."}
            </p>
          )}
        </div>
        <div className={s.vs}>
          <span>Typical Victorian home</span>
          <b>{n(TYPICAL_ANNUAL_KWH)} kWh</b>
          <em className={vsTypical > 0.1 ? s.up : vsTypical < -0.1 ? s.down : s.flat}>
            {Math.abs(vsTypical) <= 0.1 ? "About the same" : `${Math.round(Math.abs(vsTypical) * 100)}% ${vsTypical > 0 ? "more" : "less"}`}
          </em>
        </div>
      </div>

      <div className={s.months} aria-label={fc ? "Forecast use by month" : "Estimated use by month"}>
        {months.map((x) => {
          const billed = !!fc && fc.covered[x.month] > 0;
          return (
            <div
              key={x.month}
              className={`${s.month} ${x.month === m ? s.now : ""} ${billed ? s.billed : ""}`}
              title={`${MONTH_NAMES[x.month]}: about ${n(x.kwh)} kWh${billed ? " (from your bill)" : ""}`}
            >
              <span className={s.col}>
                <span className={s.bar} style={{ height: `${Math.max(4, Math.round((x.kwh / max) * 100))}%` }}>
                  {x.month === m && <span className={s.val}>{n(x.kwh)}</span>}
                </span>
              </span>
              <span className={s.lab}>{MONTH_NAMES[x.month][0]}</span>
            </div>
          );
        })}
      </div>
      {fc && (
        <div className={s.legend}>
          <span><i className={s.lgBilled} /> From your bill</span>
          <span><i className={s.lgForecast} /> Forecast</span>
          <span><i className={s.lgNow} /> This month</span>
        </div>
      )}

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
        {fc && Math.abs(adjust) >= 1 && (
          <div className={`${s.part} ${s.partBill}`}>
            <span className={s.partName}><b>Matched to your bill</b><small>Every month scaled by {Math.round(fc.factor * 100)}%</small></span>
            <span className={s.partTrack}><span style={{ width: `${Math.round((Math.abs(adjust) / biggest) * 100)}%` }} /></span>
            <b className={s.partVal}>{adjust > 0 ? "+" : "−"}{n(Math.abs(adjust))}</b>
          </div>
        )}
      </div>

      <p className={s.note}>
        {fc
          ? "Your bill sets how much you use; your answers set how it moves through the year (heating in winter, air-con in summer). Plans are compared on the forecast's average month, so winter and summer both count."
          : "Built from published averages for Melbourne homes (AER and ESC), adjusted for your answers. Plans are compared on your average across the year, so winter and summer both count. A bill gives the real number."}
      </p>
    </div>
  );
}
