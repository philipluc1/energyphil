"use client";

import { useMemo, useState } from "react";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import { compute, type ComparisonInput } from "./DashboardComparison";
import { rankPlans, type UsageInput } from "@/lib/plans";
import { cheapestPerRetailer } from "@/lib/onePerRetailer";
import { currentPricer, kwhOf } from "@/lib/homeInsights";
import { MONTH_DAYS, monthlyEstimate, type HomeProfile } from "@/lib/profileUsage";
import s from "./insights.module.css";

// "What if my usage changes?" Drag the usage or tap a scenario and the
// cheapest retailers re-rank live, with your own plan's cost as a line, so
// members see which plans hold up across usage and which only win at one.

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const SHOW = 6;
const ROW_H = 56;
const EV_KWH_PER_DAY = 7;

function adjust(u: UsageInput, factor: number, evPerDay: number): UsageInput {
  const out = { ...u, peak: u.peak * factor, shoulder: u.shoulder * factor, offpeak: u.offpeak * factor, anytime: u.anytime * factor, cl: u.cl * factor };
  const ev = evPerDay * u.days;
  if (ev > 0) {
    // Overnight charging: the off-peak band on a time-of-use home, else all-day.
    if (u.peak + u.shoulder + u.offpeak > 0) out.offpeak += ev;
    else out.anytime += ev;
  }
  return out;
}

/** Winter and summer against the year's daily average, from their answers. */
function seasonFactors(profile: HomeProfile | null): { winter: number; summer: number } | null {
  if (!profile) return null;
  const { months } = monthlyEstimate(profile);
  const perDay = (ms: number[]) => ms.reduce((a, m) => a + months[m].kwh, 0) / ms.reduce((a, m) => a + MONTH_DAYS[m], 0);
  const year = months.reduce((a, m) => a + m.kwh, 0) / 365;
  if (!(year > 0)) return null;
  return { winter: perDay([5, 6, 7]) / year, summer: perDay([11, 0, 1]) / year };
}

export default function WhatIfPanel({ input, member, profile }: { input: ComparisonInput; member: boolean; profile: HomeProfile | null }) {
  const c = useMemo(() => compute(input), [input]);
  const seasons = useMemo(() => seasonFactors(profile), [profile]);
  const [pct, setPct] = useState(100);
  const [ev, setEv] = useState(false);
  const [season, setSeason] = useState<"none" | "winter" | "summer">("none");

  const base = c && !c.average ? c.usage : null;
  const nowPrice = useMemo(() => (c && base ? currentPricer({ rates: input.currentRates ?? null, network: input.distributor, you: c.you, base }) : null), [c, base, input.currentRates, input.distributor]);

  const factor = (pct / 100) * (season === "winter" && seasons ? seasons.winter : season === "summer" && seasons ? seasons.summer : 1);
  const evOn = ev && input.ev !== true;
  const ranked = useMemo(() => {
    if (!base) return null;
    const u = adjust(base, factor, evOn ? EV_KWH_PER_DAY : 0);
    const all = rankPlans(input.distributor, u, { ev: input.ev === true || evOn, hasSolar: (u.solarExportKwh ?? 0) > 0, currentRetailer: input.currentRetailer ?? null });
    const open = cheapestPerRetailer(all.filter((m) => !m.restricted));
    return { u, list: open.slice(0, SHOW), first: open[0] };
  }, [base, factor, evOn, input.distributor, input.ev, input.currentRetailer]);

  const baseOrder = useMemo(() => {
    if (!base) return [] as string[];
    const all = rankPlans(input.distributor, base, { ev: input.ev === true, hasSolar: (base.solarExportKwh ?? 0) > 0, currentRetailer: input.currentRetailer ?? null });
    return cheapestPerRetailer(all.filter((m) => !m.restricted)).map((m) => m.plan[0]);
  }, [base, input.distributor, input.ev, input.currentRetailer]);

  if (!c || !base || !ranked || !nowPrice || ranked.list.length === 0) return null;

  const perYear = 365 / ranked.u.days;
  const youYear = nowPrice(ranked.u) * perYear;
  const max = Math.max(youYear, ...ranked.list.map((m) => m.total * perYear), 1);
  const kwhDay = kwhOf(ranked.u) / ranked.u.days;
  const changed = pct !== 100 || ev || season !== "none";
  const firstNow = ranked.first.plan[0];
  const firstBefore = baseOrder[0];
  // Free accounts see the top two without names, as everywhere else.
  const hidden = (i: number) => !member && i < 2;
  const youLabel = c.haveBill ? "your plan" : "the default offer";

  return (
    <section className={s.wi} aria-labelledby="wi-title">
      <div className={s.wiHead}>
        <h3 id="wi-title">What if my usage changes?</h3>
        {changed && <button type="button" className={s.wiReset} onClick={() => { setPct(100); setEv(false); setSeason("none"); }}>Back to my bill</button>}
      </div>
      <p className={s.sub}>Drag or tap a scenario: the cheapest retailers re-rank for that usage. The orange line is {youLabel}.</p>
      <div className={s.wiControls}>
        <div className={s.wiSlider}>
          <label htmlFor="wi-range"><span>Usage</span><b>{kwhDay.toFixed(1)} kWh a day · {pct}% of your bill</b></label>
          <input id="wi-range" type="range" min={50} max={200} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          <div className={s.wiTicks}><span>Half</span><span>Your bill</span><span>Double</span></div>
        </div>
        <div className={s.wiChips}>
          {seasons && (
            <>
              <button type="button" aria-pressed={season === "winter"} className={`${s.shift} ${season === "winter" ? s.shiftOn : ""}`} onClick={() => setSeason(season === "winter" ? "none" : "winter")}>
                <Icon name="snow" size={15} /> Winter <small>{seasons.winter >= 1 ? "+" : ""}{Math.round((seasons.winter - 1) * 100)}%</small>
              </button>
              <button type="button" aria-pressed={season === "summer"} className={`${s.shift} ${season === "summer" ? s.shiftOn : ""}`} onClick={() => setSeason(season === "summer" ? "none" : "summer")}>
                <Icon name="sun" size={15} /> Summer <small>{seasons.summer >= 1 ? "+" : ""}{Math.round((seasons.summer - 1) * 100)}%</small>
              </button>
            </>
          )}
          {input.ev !== true && (
            <button type="button" aria-pressed={ev} className={`${s.shift} ${ev ? s.shiftOn : ""}`} onClick={() => setEv(!ev)}>
              <Icon name="car" size={15} /> Add an EV <small>+{EV_KWH_PER_DAY} kWh a day</small>
            </button>
          )}
        </div>
      </div>

      <ol className={s.wiList} style={{ height: ranked.list.length * ROW_H }} aria-live="polite">
        {ranked.list.map((m, i) => {
          const year = m.total * perYear;
          const diff = youYear - year;
          const was = baseOrder.indexOf(m.plan[0]);
          const move = was === -1 ? 0 : was - i;
          const hide = hidden(i);
          return (
            <li key={m.plan[0]} className={s.wiRow} style={{ transform: `translateY(${i * ROW_H}px)` }}>
              <span className={s.wiRank}>{i + 1}</span>
              {hide ? <span className={s.wiLock}><Icon name="lock" size={14} /></span> : <RetailerLogo name={m.plan[0]} size={30} square />}
              <span className={s.wiWho}>
                <b>
                  {hide ? "Plus members see this retailer" : m.plan[0]}
                  {changed && move !== 0 && !hide && <em className={`${s.wiMove} ${move > 0 ? s.wiUp : s.wiDown}`}>{move > 0 ? `▲${move}` : `▼${-move}`}</em>}
                </b>
                <small>{hide ? "Retailer and plan hidden" : m.plan[2]}</small>
              </span>
              <span className={s.wiTrack}>
                <span className={s.wiFill} style={{ width: `${(year / max) * 100}%` }} />
                <span className={s.wiYou} style={{ left: `${(youYear / max) * 100}%` }} aria-hidden="true" />
              </span>
              <span className={s.wiNums}>
                <b>{whole(year)}<small style={{ fontWeight: 600, color: "#5b6476" }}>/yr</small></b>
                <small className={diff >= 1 ? s.good : diff <= -1 ? s.bad : s.muted}>{Math.abs(diff) < 1 ? "Same" : diff > 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <p className={s.wiSummary}>
        {!changed
          ? <>At your bill&apos;s usage, {youLabel} costs <b>{whole(youYear)}</b> a year.</>
          : firstNow === firstBefore
            ? <>The cheapest retailer {member ? <>(<b>{firstNow}</b>) </> : ""}stays on top at this usage. {youLabel[0].toUpperCase() + youLabel.slice(1)} would cost <b>{whole(youYear)}</b> a year.</>
            : <>At this usage, <b>{member ? firstNow : "a different retailer"}</b> takes the top spot{member && firstBefore ? <> from {firstBefore}</> : null}. {youLabel[0].toUpperCase() + youLabel.slice(1)} would cost <b>{whole(youYear)}</b> a year.</>}
      </p>
    </section>
  );
}
