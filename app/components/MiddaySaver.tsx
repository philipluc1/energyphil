"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Icon from "./Icon";
import DashOverlay from "./DashOverlay";
import { compute, type ComparisonInput } from "./DashboardComparison";
import { rankPlans, topOpen } from "@/lib/plans";
import { usageCurve, type UsageShapeKey } from "@/lib/usageShape";
import type { HomeProfile } from "@/lib/profileUsage";
import {
  MIDDAY_FREE_CAP_KWH,
  MIDDAY_RATES,
  MIDDAY_SOURCE_URL,
  WINDOW_LABEL,
  priceMiddayDay,
  shiftToMidday,
  windowAt,
  type MiddayWindow,
} from "@/lib/middayPowerSaver";
import { useOpenParam } from "@/lib/useOpenParam";
import s from "./insights.module.css";

// "Free midday power: worth it for you?" The Victorian Midday Power Saver
// (11am–2pm free, from 1 Oct 2026) priced on the member's modelled day, with
// chores they could move into the free window. Compared with the cheapest
// plan for the same usage, solar credit and hot-water meter left out on both
// sides so it's like for like.

const whole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-AU")}`;
const WINDOW_COLOR: Record<MiddayWindow, string> = { free: "#16a34a", soak: "#5eead4", peak: "#f87171", offpeak: "#c7cde0" };
const WINDOW_CLASS: Record<MiddayWindow, string> = { free: s.wFree, soak: s.wSoak, peak: s.wPeak, offpeak: s.wOff };
const RATE_KEY: Record<Exclude<MiddayWindow, "free">, "soak" | "peak" | "offpeak"> = { soak: "soak", peak: "peak", offpeak: "offpeak" };

type ShiftId = "laundry" | "dishes" | "climate" | "hotwater" | "ev";
interface Shift { id: ShiftId; label: string; kwh: number; from: "evening" | "overnight" }

function shiftsFor(profile: HomeProfile | null, ev: boolean): Shift[] {
  const out: Shift[] = [
    { id: "laundry", label: "Washing and drying", kwh: 2, from: "evening" },
    { id: "dishes", label: "Dishwasher", kwh: 1.2, from: "evening" },
    { id: "climate", label: "Heat or cool the house before 2pm", kwh: 2, from: "evening" },
  ];
  if (profile?.hotWater === "electric_general" || profile?.hotWater === "heat_pump") out.push({ id: "hotwater", label: "Hot water on a midday timer", kwh: 2.5, from: "overnight" });
  if (ev) out.push({ id: "ev", label: "Charge the car at midday", kwh: 7, from: "overnight" });
  return out;
}

interface Model {
  network: ComparisonInput["distributor"];
  hourlyBase: number[];
  dailyKwh: number;
  bestYear: number;
  bestName: string | null;
  youYear: number | null;
  days: number;
  hasSolar: boolean;
  hasCl: boolean;
}

function useMiddayModel(input: ComparisonInput, shape: UsageShapeKey, evOvernight: boolean, member: boolean): Model | null {
  return useMemo(() => {
    const c = compute(input);
    if (!c) return null;
    const u = c.usage;
    const general = u.peak + u.shoulder + u.offpeak + u.anytime;
    if (!(general > 0) || !(u.days > 0)) return null;
    const dailyKwh = general / u.days;
    const curve = usageCurve(shape, dailyKwh, { evOvernight });
    // Like for like: the same usage without the solar credit or hot-water meter.
    const plain = { ...u, cl: 0, solarExportKwh: 0 };
    const best = topOpen(rankPlans(input.distributor, plain, { ev: input.ev === true, hasSolar: false, currentRetailer: input.currentRetailer ?? null }));
    if (!best) return null;
    const hasSolar = (u.solarExportKwh ?? 0) > 0;
    const hasCl = u.cl > 0;
    return {
      network: input.distributor,
      hourlyBase: curve.grid,
      dailyKwh,
      bestYear: (best.total / u.days) * 365,
      bestName: member ? best.plan[0] : null,
      youYear: c.haveBill && !hasSolar && !hasCl && !c.average ? c.you * c.perYear : null,
      days: u.days,
      hasSolar,
      hasCl,
    };
  }, [input, shape, evOvernight, member]);
}

function applyShifts(hourly: number[], shifts: Shift[], on: Set<ShiftId>): { hourly: number[]; moved: number } {
  let h = hourly;
  let moved = 0;
  for (const x of shifts) {
    if (!on.has(x.id)) continue;
    const before = h[11] + h[12] + h[13];
    h = shiftToMidday(h, x.kwh, x.from);
    moved += h[11] + h[12] + h[13] - before;
  }
  return { hourly: h, moved };
}

// ---- The 24-hour clock ----
const CX = 110;
const pt = (r: number, hour: number) => {
  const a = (hour / 24) * 2 * Math.PI - Math.PI / 2;
  return [CX + r * Math.cos(a), CX + r * Math.sin(a)];
};
function arc(r: number, h0: number, h1: number) {
  const [x0, y0] = pt(r, h0);
  const [x1, y1] = pt(r, h1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${h1 - h0 > 12 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function melbourneHour(): number {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h + m / 60;
  } catch {
    return 12;
  }
}

export function DayClock({ hourly, mini = false }: { hourly: number[]; mini?: boolean }) {
  const max = Math.max(...hourly, 0.01);
  const now = melbourneHour();
  const [hx, hy] = pt(mini ? 70 : 84, now);
  return (
    <svg viewBox="0 0 220 220" className={mini ? s.clockMini : s.clock} role="img" aria-label="Your day on the Midday Power Saver: free from 11am to 2pm, peak from 4pm to 9pm">
      {Array.from({ length: 24 }, (_, h) => (
        <path key={`r${h}`} d={arc(98, h + 0.04, h + 0.96)} stroke={WINDOW_COLOR[windowAt(h)]} strokeWidth={mini ? 20 : 14} fill="none" />
      ))}
      {!mini && hourly.map((v, h) => {
        const r0 = 38;
        const len = 6 + (v / max) * 44;
        const [x0, y0] = pt(r0, h + 0.5);
        const [x1, y1] = pt(r0 + len, h + 0.5);
        return <line key={`b${h}`} className={s.bar} style={{ animationDelay: `${h * 18}ms` }} x1={x0} y1={y0} x2={x1} y2={y1} stroke={WINDOW_COLOR[windowAt(h)]} strokeWidth={6} strokeLinecap="round" />;
      })}
      {!mini && ["12am", "6am", "12pm", "6pm"].map((t, i) => {
        const [x, y] = pt(98, i * 6);
        return <text key={t} x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#12141c" stroke="#fff" strokeWidth="3" paintOrder="stroke">{t}</text>;
      })}
      <line className={s.hand} x1={CX} y1={CX} x2={hx} y2={hy} stroke="#12141c" strokeWidth={mini ? 5 : 3} strokeLinecap="round" />
      <circle cx={CX} cy={CX} r={mini ? 8 : 5} fill="#12141c" />
    </svg>
  );
}

// ---- Side card ----
export function MiddayCard({ input, shape, evOvernight, profile, member }: {
  input: ComparisonInput;
  shape: UsageShapeKey;
  evOvernight: boolean;
  profile: HomeProfile | null;
  member: boolean;
}) {
  const m = useMiddayModel(input, shape, evOvernight, member);
  const [open, setOpen] = useState(false);
  useOpenParam("midday", () => setOpen(true), !!m);
  if (!m) return null;
  const asIs = priceMiddayDay(m.network, m.hourlyBase).perDay * 365;
  const shifts = shiftsFor(profile, input.ev === true);
  const easy = new Set<ShiftId>(["laundry", "dishes"]);
  const withChores = priceMiddayDay(m.network, applyShifts(m.hourlyBase, shifts, easy).hourly).perDay * 365;
  const gapAsIs = m.bestYear - asIs;
  const gapChores = m.bestYear - withChores;
  return (
    <>
      <section
        className={`${s.side} ${s.sideOpen}`}
        style={{ "--accent": "#16a34a", "--tagBg": "#ecfdf3", "--tagFg": "#15803d" } as CSSProperties}
        aria-labelledby="midday-side-title"
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) setOpen(true); }}
      >
        <span className={s.tag}><Icon name="sun" size={13} /> New: free power 11am–2pm</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <DayClock hourly={m.hourlyBase} mini />
          <h3 id="midday-side-title" className={s.sideTitle}>
            {gapChores >= 1 ? <><b className={s.good}>{whole(gapChores)}</b> a year less</> : <><b className={s.muted}>{whole(gapChores)}</b> a year more</>}
            <br /><small style={{ fontSize: 13, color: "#5b6476", fontWeight: 600 }}>than the cheapest plan, if you run laundry and the dishwasher at midday</small>
          </h3>
        </div>
        <p className={s.sideLine}>
          As you are now: {gapAsIs >= 1 ? <><b className={s.good}>{whole(gapAsIs)} less</b></> : <><b>{whole(gapAsIs)} more</b></>} a year on the Midday Power Saver.
        </p>
        <button type="button" className={s.more} onClick={() => setOpen(true)}>Check it for my home →</button>
      </section>
      {open && <MiddayPage m={m} shifts={shifts} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- Full page ----
function MiddayPage({ m, shifts, onClose }: { m: Model; shifts: Shift[]; onClose: () => void }) {
  const [on, setOn] = useState<Set<ShiftId>>(new Set());
  const { hourly, moved } = applyShifts(m.hourlyBase, shifts, on);
  const day = priceMiddayDay(m.network, hourly);
  const year = day.perDay * 365;
  const gap = m.bestYear - year;
  const rates = MIDDAY_RATES[m.network];
  const top = Math.max(year, m.bestYear, m.youYear ?? 0, 1);
  const toggle = (id: ShiftId) => setOn((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const verdict = gap >= 50 ? "worth" : gap > -50 ? "close" : "not";
  return (
    <DashOverlay
      title="Free midday power: worth it for you?"
      lede={<>Victoria&apos;s <b>Midday Power Saver</b> makes power free from 11am to 2pm every day (up to {MIDDAY_FREE_CAP_KWH} kWh), with higher prices at other times. Here it is on your home&apos;s day.</>}
      bar={`${m.network} network`}
      onClose={onClose}
    >
      <div className={s.tiles}>
        <div className={`${s.tile} ${verdict === "worth" ? s.tileGood : verdict === "close" ? s.tileWarn : s.tileMuted}`}>
          <b>{gap >= 1 ? `${whole(gap)} less` : gap <= -1 ? `${whole(gap)} more` : "About the same"}</b>
          <span>a year than the cheapest plan for you{verdict === "worth" ? ": worth asking your retailer about" : verdict === "close" ? ": about level, depends on your habits" : ": your cheapest plan wins"}</span>
        </div>
        <div className={s.tile}><b>{whole(year)}</b><span>a year on the Midday Power Saver{moved > 0 ? `, moving ${moved.toFixed(1)} kWh a day to midday` : ", changing nothing"}</span></div>
        <div className={s.tile}><b>{whole(m.bestYear)}</b><span>a year on the cheapest plan for you{m.bestName ? ` (${m.bestName})` : ""}</span></div>
      </div>

      <section className={s.card} aria-labelledby="midday-move">
        <h3 id="midday-move">What could you move to midday?</h3>
        <p className={s.sub}>Tap what you could run between 11am and 2pm. Figures are a typical day&apos;s use for each.</p>
        <div className={s.shifts}>
          {shifts.map((x) => (
            <button key={x.id} type="button" aria-pressed={on.has(x.id)} className={`${s.shift} ${on.has(x.id) ? s.shiftOn : ""}`} onClick={() => toggle(x.id)}>
              <span className={s.shiftBox} aria-hidden="true">{on.has(x.id) ? "✓" : ""}</span>
              {x.label} <small>~{x.kwh} kWh</small>
            </button>
          ))}
        </div>
        <div className={s.compare} style={{ marginTop: 16 }}>
          <div className={s.cmpRow}><span>Midday Power Saver</span><span className={s.cmpTrack}><i className={`${s.cmpFill} ${s.fillMidday}`} style={{ width: `${(year / top) * 100}%` }} /></span><b>{whole(year)}</b></div>
          <div className={s.cmpRow}><span>Cheapest plan for you</span><span className={s.cmpTrack}><i className={`${s.cmpFill} ${s.fillBest}`} style={{ width: `${(m.bestYear / top) * 100}%` }} /></span><b>{whole(m.bestYear)}</b></div>
          {m.youYear !== null && <div className={s.cmpRow}><span>Your bill now</span><span className={s.cmpTrack}><i className={`${s.cmpFill} ${s.fillYou}`} style={{ width: `${(m.youYear / top) * 100}%` }} /></span><b>{whole(m.youYear)}</b></div>}
        </div>
      </section>

      <section className={s.card} aria-labelledby="midday-day">
        <h3 id="midday-day">Your day, hour by hour</h3>
        <p className={s.sub}>The ring is the price at each hour; the bars are when your home uses power ({m.dailyKwh.toFixed(1)} kWh a day). The hand is now.</p>
        <div className={s.clockWrap}>
          <DayClock hourly={hourly} />
          <ul className={s.legend}>
            {(["free", "soak", "peak", "offpeak"] as MiddayWindow[]).map((w) => (
              <li key={w}>
                <i className={WINDOW_CLASS[w]} />
                <span>
                  <b>{WINDOW_LABEL[w]}</b>
                  <small>
                    {w === "free" ? `Free up to ${MIDDAY_FREE_CAP_KWH} kWh a day` : `${(rates[RATE_KEY[w]] * 100).toFixed(1)}c a kWh`} · {day.kwh[w].toFixed(1)} kWh a day
                  </small>
                </span>
                <em>{w === "free" ? (day.cost.free > 0 ? whole(day.cost.free * 365) : "$0") : whole(day.cost[w] * 365)}<small>a year</small></em>
              </li>
            ))}
            <li>
              <i style={{ background: "#12141c" }} />
              <span><b>Daily supply charge</b><small>{(rates.supply * 100).toFixed(1)}c a day</small></span>
              <em>{whole(rates.supply * 365)}<small>a year</small></em>
            </li>
          </ul>
        </div>
      </section>

      <section className={s.card} aria-labelledby="midday-know">
        <h3 id="midday-know">Good to know</h3>
        <ul className={s.fineList}>
          <li>It&apos;s opt-in: ask your retailer. You need a smart meter, and retailers must explain the cost before you agree.</li>
          <li>Prices here are the recommended <b>maximum</b> prices for your network (1 Oct 2026 to 30 Jun 2027). Your retailer can charge less.</li>
          <li>Your day is modelled from your bill and answers, not your meter, so treat this as a guide.</li>
          {m.hasSolar && <li>Your solar credit is left out on both sides, so the comparison is like for like. Your retailer sets the credit.</li>}
          {m.hasCl && <li>Your separate hot-water meter is left out on both sides; it&apos;s charged separately on this offer.</li>}
          <li>
            More from the Victorian Government: <a href={MIDDAY_SOURCE_URL} target="_blank" rel="noreferrer">Victorian Midday Power Saver</a>.
          </li>
        </ul>
      </section>
    </DashOverlay>
  );
}
