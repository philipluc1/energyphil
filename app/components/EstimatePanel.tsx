"use client";

import { useMemo, useState } from "react";
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

const BILL_LENGTHS: [number, string][] = [[30, "a month"], [61, "2 months"], [91, "3 months"]];

/**
 * The first thing on the no-bill page: "Got a recent bill? Enter its kWh".
 * One real figure beats any amount of guessing, so it sits above the
 * questions; the questions then only set how use moves through the year.
 */
/** "Kilowatt-hours" or "just the dollar amount": two ways to tell us about a bill. */
export type BillFigure = "kwh" | "dollars";

/** Where to find the kWh: a made-up example of the usage table most bills have. */
function KwhGuide() {
  return (
    <div className={s.guide}>
      <span className={s.guideTag}>Example bill (made-up numbers)</span>
      <table className={s.guideTable}>
        <thead>
          <tr><th>Meter</th><th>Start read</th><th>End read</th><th>Usage kWh</th></tr>
        </thead>
        <tbody>
          <tr className={s.guideHit}><td>…/E1 (from the grid)</td><td>16,968</td><td>17,132</td><td><b>164.4</b> ← this one</td></tr>
          <tr className={s.guideSkip}><td>…/B1 (solar to the grid)</td><td>18,886</td><td>19,050</td><td>163.5 ✗ not this</td></tr>
        </tbody>
      </table>
      <ul className={s.guideList}>
        <li>Look for <b>Usage</b>, <b>Consumption</b> or <b>Quantity</b> in kWh, in the usage or charges section (often page 2).</li>
        <li>Several lines (peak, off-peak, shoulder, controlled load)? <b>Add them up.</b></li>
        <li>Leave out solar export or &ldquo;feed-in&rdquo; lines: that&apos;s power you sent out, not used.</li>
      </ul>
    </div>
  );
}

/** A made-up bill with an arrow at the number to copy: the kWh total, or the
 *  amount for this bill when they only know the dollars. */
function MiniBill({ figure }: { figure: BillFigure }) {
  const kwh = figure === "kwh";
  return (
    <figure className={s.mini} aria-label={kwh ? "Example bill: the total usage in kWh is the number to copy" : "Example bill: the new charges for this bill is the number to copy"}>
      <span className={s.miniTag}>Example bill</span>
      <div className={s.miniPaper}>
        <span className={s.miniLogo} />
        <span className={s.miniLine} style={{ width: "62%" }} />
        <span className={s.miniLine} style={{ width: "44%" }} />
        <div className={s.miniTable}>
          <div><span>Peak</span><span>612 kWh</span></div>
          <div><span>Off-peak</span><span>538 kWh</span></div>
          <div className={kwh ? s.miniHit : undefined}><span>Total usage</span><b>1,150 kWh</b></div>
        </div>
        <div className={`${s.miniTotal} ${!kwh ? s.miniHit : ""}`}><span>New charges</span><b>$425.31</b></div>
      </div>
      <span className={`${s.miniArrow} ${kwh ? s.miniArrowKwh : s.miniArrowDollars}`} aria-hidden="true">
        <svg viewBox="0 0 60 30" width="60" height="30"><path d="M58 4 C 40 4, 26 10, 10 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M4 26 L14 16 M4 26 L17 26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        <em>{kwh ? "Copy this" : "This one"}</em>
      </span>
    </figure>
  );
}

/**
 * The first thing on the no-bill page: "Got a recent bill? Start with it".
 * One real figure beats any amount of guessing, so it sits above the
 * questions; the questions then only set how use moves through the year.
 * People who can't find the kWh can give the dollar amount instead, and we
 * work the kWh out from typical Victorian rates.
 */
export function BillKwhCard({
  bill,
  days,
  onDays,
  profile,
  figure,
  onFigure,
  dollarsRaw,
  onDollars,
  kwhFromDollars,
  compact = false,
}: {
  bill: BillKwhInput;
  days: number;
  onDays: (d: number) => void;
  profile: HomeProfile;
  figure: BillFigure;
  onFigure: (f: BillFigure) => void;
  /** The bill's total, shared with "Roughly what do you pay?". */
  dollarsRaw: string;
  onDollars: (raw: string) => void;
  /** kWh worked out from the dollars (null when it can't be). */
  kwhFromDollars: number | null;
  /** Inside "Enter the kWh from my bill": no heading or "no bill" line, the option says it. */
  compact?: boolean;
}) {
  const answersOnly = useMemo(() => monthlyEstimate(profile).breakdown.total, [profile]);
  const [guide, setGuide] = useState(false);
  const fc = bill.forecast;
  const dollars = parseFloat(dollarsRaw);
  return (
    <section className={`${s.top1} ${fc ? s.top1On : ""}`} aria-labelledby="bill-kwh-title">
      {!compact && <div className={s.top1Head}>
        <span className={s.top1Icon} aria-hidden="true"><Icon name="receipt" size={22} /></span>
        <div>
          <h3 id="bill-kwh-title" className={s.top1Title}>Got a recent bill? Start with it</h3>
          <p className={s.top1Sub}>One real number beats our best guess. Then answer the questions below so we know how your use moves through the year.</p>
        </div>
      </div>}
      <div className={s.top1Body}>
      <div className={s.top1Inputs}>
      <div className={s.figure} role="group" aria-label="What you can find on your bill">
        <button type="button" aria-pressed={figure === "kwh"} onClick={() => onFigure("kwh")}>I can see the kWh</button>
        <button type="button" aria-pressed={figure === "dollars"} onClick={() => onFigure("dollars")}>I only know the $ amount</button>
      </div>
      <div className={s.top1Row}>
        {figure === "kwh" ? (
          <label className={s.calKwh}>
            <span className={s.srOnly}>kWh used on the bill</span>
            <input type="number" inputMode="decimal" min={0} placeholder="e.g. 1,150" value={bill.kwhRaw} onChange={(e) => bill.onKwh(e.target.value)} />
            <span>kWh</span>
          </label>
        ) : (
          <label className={s.calKwh}>
            <span>$</span>
            <span className={s.srOnly}>The bill&apos;s total</span>
            <input type="number" inputMode="decimal" min={0} step={0.01} placeholder="e.g. 310" value={dollarsRaw} onChange={(e) => onDollars(e.target.value)} />
          </label>
        )}
        <span className={s.calWords}>over</span>
        <div className={s.lengths} role="group" aria-label="How long the bill covers">
          {BILL_LENGTHS.map(([d, label]) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => onDays(d)}>{label}</button>
          ))}
          {!BILL_LENGTHS.some(([d]) => d === days) && <span className={s.lengthOther}>{days} days</span>}
        </div>
        {(figure === "kwh" ? bill.kwhRaw : dollarsRaw) && (
          <button type="button" className={s.calClear} onClick={() => (figure === "kwh" ? bill.onKwh("") : onDollars(""))}>Clear</button>
        )}
      </div>
      {figure === "kwh" ? (
        <>
          <button type="button" className={s.guideBtn} aria-expanded={guide} onClick={() => setGuide((g) => !g)}>
            {guide ? "Hide the example ▴" : "Where's the kWh on my bill? ▾"}
          </button>
          {guide && <KwhGuide />}
        </>
      ) : (
        <small className={s.calHint}>
          Use the charges for this bill only (&ldquo;new charges&rdquo; or &ldquo;this bill&rdquo;), not an amount owing from before. We work out the kWh from typical
          Victorian rates, so it&apos;s close rather than exact.
          {dollars > 0 && kwhFromDollars === null && <> That&apos;s less than the daily supply charge alone: check the amount and the bill length.</>}
          {kwhFromDollars !== null && <> That works out at about <b>{n(kwhFromDollars)} kWh</b>.</>}
        </small>
      )}
      </div>
      <MiniBill figure={figure} />
      </div>
      {fc ? (
        <p className={s.top1Result}>
          <Icon name="check" size={16} /> Forecast from your bill: <b>{n(fc.annual)} kWh a year</b>
          <span> (your answers alone would say {n(answersOnly)})</span>
        </p>
      ) : (
        compact ? null : <p className={s.top1Skip}>No bill handy? Skip this: we&apos;ll estimate from your answers.</p>
      )}
    </section>
  );
}

/**
 * What we think the home uses, and why: the year by category, each month as
 * a bar (this month highlighted), and how it compares with a typical home.
 * With a bill's kWh, the same shape is scaled to the bill and becomes a
 * 12-month forecast. `showInput` false when the kWh is asked at the top of the page.
 */
export default function EstimatePanel({ profile, billDays, bill, showInput = true }: { profile: HomeProfile; billDays: number; bill?: BillKwhInput; showInput?: boolean }) {
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
      {bill && showInput && (
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
