"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Icon from "./Icon";
import DashOverlay from "./DashOverlay";
import { compute, type ComparisonInput } from "./DashboardComparison";
import { VDO, computeBill, type PlanRow } from "@/lib/plans";
import { currentPricer, forecastYear, type Forecast } from "@/lib/homeInsights";
import { MONTH_NAMES, type HomeProfile } from "@/lib/profileUsage";
import { useOpenParam } from "@/lib/useOpenParam";
import s from "./insights.module.css";

// "Your year ahead": the next bill and twelve months, month by month, on
// their plan and on the cheapest plan. Seasonal when we have their answers.

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const short = (m: number) => MONTH_NAMES[m].slice(0, 3);
const dayMonth = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

function useForecast(input: ComparisonInput, profile: HomeProfile | null, member: boolean) {
  return useMemo(() => {
    const c = compute(input);
    if (!c || c.average) return null;
    const vdoRow: PlanRow = ["Default offer", input.distributor, "Victorian Default Offer", "STANDING", VDO[input.distributor].supply, VDO[input.distributor].usage, null, null, null, VDO[input.distributor].cl, null];
    const now = c.haveBill
      ? currentPricer({ rates: input.currentRates ?? null, network: input.distributor, you: c.you, base: c.usage })
      : (u: Parameters<typeof computeBill>[1]) => computeBill(vdoRow, u) ?? 0;
    const best = (u: Parameters<typeof computeBill>[1]) => computeBill(c.top.plan, u) ?? 0;
    const f = forecastYear({ base: c.usage, profile, now, best });
    if (!f) return null;
    return { f, simpleYear: c.you * c.perYear, nowLabel: c.haveBill ? "Your plan" : "The default offer", bestLabel: member ? `Cheapest: ${c.top.plan[0]}` : "The cheapest plan" };
  }, [input, profile, member]);
}

export function ForecastCard({ input, profile, member }: { input: ComparisonInput; profile: HomeProfile | null; member: boolean }) {
  const data = useForecast(input, profile, member);
  const [open, setOpen] = useState(false);
  useOpenParam("year", () => setOpen(true), !!data);
  if (!data) return null;
  const { f } = data;
  const max = Math.max(...f.months.map((m) => m.now), 1);
  const save = f.next.now - f.next.best;
  return (
    <>
      <section
        className={`${s.side} ${s.sideOpen}`}
        style={{ "--accent": "#22306e", "--tagBg": "#e8ebf8", "--tagFg": "#22306e" } as CSSProperties}
        aria-labelledby="fc-side-title"
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) setOpen(true); }}
      >
        <span className={s.tag}><Icon name="calendar" size={13} /> Your year ahead</span>
        <h3 id="fc-side-title" className={s.sideTitle}>
          Next bill about <b>{whole(f.next.now)}</b>
        </h3>
        <p className={s.sideLine}>
          {f.next.days} days to {dayMonth(f.next.end)}.{save >= 1 ? <> On the cheapest plan: <b className={s.good}>{whole(f.next.best)}</b>.</> : null}
        </p>
        <div className={s.spark} aria-hidden="true">
          {f.months.map((m, i) => <i key={i} className={i === 0 ? s.sparkNow : ""} style={{ height: `${Math.max(8, (m.now / max) * 100)}%`, animationDelay: `${i * 30}ms` }} />)}
        </div>
        <button type="button" className={s.more} onClick={() => setOpen(true)}>See my year, month by month →</button>
      </section>
      {open && <ForecastPage f={f} simpleYear={data.simpleYear} nowLabel={data.nowLabel} bestLabel={data.bestLabel} seasonalNote={profile !== null} onClose={() => setOpen(false)} />}
    </>
  );
}

function ForecastPage({ f, simpleYear, nowLabel, bestLabel, seasonalNote, onClose }: { f: Forecast; simpleYear: number; nowLabel: string; bestLabel: string; seasonalNote: boolean; onClose: () => void }) {
  const max = Math.max(...f.months.map((m) => Math.max(m.now, m.best)), 1);
  const peak = f.months.reduce((a, m) => (m.now / m.days > a.now / a.days ? m : a), f.months[0]);
  const low = f.months.reduce((a, m) => (m.now / m.days < a.now / a.days ? m : a), f.months[0]);
  const saveYear = f.yearNow - f.yearBest;
  // Which months the next bill covers (for the dashed box).
  const nextMonths = new Set<number>();
  {
    let left = f.next.days;
    let i = 0;
    const first = new Date();
    let room = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() - first.getDate() + 1;
    while (left > 0 && i < 12) { nextMonths.add(i); left -= room; i++; room = f.months[i]?.days ?? 30; }
  }
  return (
    <DashOverlay title="Your year ahead" lede="What your power should cost over the next twelve months, on your plan and on the cheapest plan for you." bar="Estimate" onClose={onClose}>
      <div className={s.tiles}>
        <div className={s.tile}><b>{whole(f.next.now)}</b><span>your next bill ({f.next.days} days to {dayMonth(f.next.end)}, about {f.next.kwh.toLocaleString("en-AU")} kWh)</span></div>
        <div className={`${s.tile} ${saveYear >= 1 ? s.tileGood : ""}`}><b>{whole(f.next.best)}</b><span>the same bill on the cheapest plan{saveYear >= 1 ? `: ${whole(f.next.now - f.next.best)} less` : ""}</span></div>
        <div className={s.tile}><b>{whole(f.yearNow)}</b><span>the next 12 months on {nowLabel.toLowerCase()}{saveYear >= 1 ? `, or ${whole(f.yearBest)} on the cheapest` : ""}</span></div>
      </div>

      <section className={s.card} aria-labelledby="fc-chart">
        <h3 id="fc-chart">Month by month</h3>
        <p className={s.sub}>
          {seasonalNote ? <>Dearest month: <b>{MONTH_NAMES[peak.month]}</b> ({whole(peak.now)}). Cheapest: <b>{MONTH_NAMES[low.month]}</b> ({whole(low.now)}).</> : "Your bill's daily average, month by month. Add your home details on My home for a seasonal forecast."}
          {" "}The dashed box is your next bill.
        </p>
        <div className={s.fcChart} role="img" aria-label={`Forecast cost by month, ${nowLabel} and the cheapest plan`}>
          {f.months.map((m, i) => (
            <div key={i} className={s.fcCol} title={`${MONTH_NAMES[m.month]} ${m.year}: ${whole(m.now)} on ${nowLabel.toLowerCase()}, ${whole(m.best)} on the cheapest plan, ${m.kwh} kWh`}>
              {nextMonths.has(i) && <span className={s.fcNext} aria-hidden="true" />}
              <div className={s.fcBars}>
                <i className={s.fcNow} style={{ height: `${(m.now / max) * 100}%`, animationDelay: `${i * 35}ms` }} />
                <i className={s.fcBest} style={{ height: `${(m.best / max) * 100}%`, animationDelay: `${i * 35 + 60}ms` }} />
              </div>
              <small>{short(m.month)}</small>
            </div>
          ))}
        </div>
        <div className={s.fcLegend}>
          <span><i style={{ background: "#e8590c" }} /> {nowLabel}</span>
          <span><i style={{ background: "#16a34a" }} /> {bestLabel}</span>
        </div>
      </section>

      <section className={s.card} aria-labelledby="fc-how">
        <h3 id="fc-how">How we worked it out</h3>
        <ul className={s.fineList}>
          <li>{seasonalNote ? "Your usage month by month follows the seasons for a home like yours (heating, cooling, hot water), scaled to match your bill." : "Each month uses your bill's daily average; we don't know your home's seasons yet."}</li>
          <li>We assumed your last bill ended in {MONTH_NAMES[f.billEndMonth]}.</li>
          {seasonalNote && Math.abs(f.yearNow - simpleYear) / simpleYear > 0.05 && (
            <li>
              Elsewhere we show your bill as a year ({whole(simpleYear)}) by scaling it up evenly. Here the seasons are spread out, so the year comes to {whole(f.yearNow)}: your last bill covered {f.yearNow < simpleYear ? "dearer" : "cheaper"} months than average.
            </li>
          )}
          <li>Prices are today&apos;s. Most Victorian prices change on 1 July, so later months may differ.</li>
          <li>It&apos;s an estimate from your bill, not your meter. Your real bills will vary with the weather.</li>
        </ul>
      </section>
    </DashOverlay>
  );
}
