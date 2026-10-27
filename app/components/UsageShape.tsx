"use client";

import { useId, useMemo, useState } from "react";
import { USAGE_SHAPES, TOU_WINDOWS, usageCurve, type UsageShapeKey } from "@/lib/usageShape";
import s from "./usageshape.module.css";

// A day of power use as a smooth area chart: grid import, solar feed-in, and
// the typical time-of-use windows shaded behind it. With `pick` the three
// shapes are selectable (Learn page); without it the chart shows one home
// (the dashboard).

const HOURS = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];
const W = 720, H = 260, PAD = { l: 40, r: 12, t: 16, b: 28 };

/** A smooth path through 24 hourly points (Catmull-Rom to Bezier). */
function smooth(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function UsageShape({
  shape: fixed,
  dailyKwh,
  exportKwhPerDay = 0,
  evOvernight = false,
  pick = false,
  title,
  note,
}: {
  /** The shape to show; with `pick`, the one selected first. */
  shape?: UsageShapeKey;
  dailyKwh: number;
  exportKwhPerDay?: number;
  evOvernight?: boolean;
  /** Let the reader choose between the three shapes. */
  pick?: boolean;
  title?: string;
  note?: string;
}) {
  const [chosen, setChosen] = useState<UsageShapeKey>(fixed ?? "evening");
  const key = pick ? chosen : (fixed ?? "evening");
  const curve = useMemo(() => usageCurve(key, dailyKwh, { exportKwhPerDay, evOvernight }), [key, dailyKwh, exportKwhPerDay, evOvernight]);
  const id = useId();

  const max = Math.max(0.5, ...curve.grid, ...curve.feedIn) * 1.15;
  const x = (h: number) => PAD.l + (h / 23) * (W - PAD.l - PAD.r);
  const y = (kw: number) => H - PAD.b - (kw / max) * (H - PAD.t - PAD.b);
  const gridPts: [number, number][] = curve.grid.map((v, h) => [x(h), y(v)]);
  const feedPts: [number, number][] = curve.feedIn.map((v, h) => [x(h), y(v)]);
  const base = y(0);
  const gridPath = smooth(gridPts);
  const feedPath = smooth(feedPts);
  const area = (p: string, pts: [number, number][]) => `${p} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 10) / 10);
  const peakH = curve.grid.indexOf(Math.max(...curve.grid));
  const shapeInfo = USAGE_SHAPES.find((u) => u.key === key)!;
  const [pk0, pk1] = TOU_WINDOWS.peak;

  return (
    <section className={s.wrap} aria-labelledby={`${id}-t`}>
      {title && <h2 id={`${id}-t`} className={s.title}>{title}</h2>}
      {pick && (
        <div className={s.picks} role="tablist" aria-label="Household type">
          {USAGE_SHAPES.map((u) => (
            <button key={u.key} type="button" role="tab" aria-selected={u.key === key} className={u.key === key ? s.pickOn : s.pick} onClick={() => setChosen(u.key)}>
              <b>{u.title}</b>
              <span>{u.who}</span>
            </button>
          ))}
        </div>
      )}
      <div className={s.chartCard}>
        <div className={s.legend}>
          <span><i className={s.swGrid} /> From the grid, kW</span>
          {curve.feedInKwhPerDay > 0 && <span><i className={s.swFeed} /> Solar sent to the grid</span>}
          <span><i className={s.swPeak} /> Typical peak window, {pk0 - 12}pm to {pk1 - 12}pm</span>
        </div>
        <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${shapeInfo.title}: power use through the day, peaking around ${peakH > 12 ? `${peakH - 12}pm` : `${peakH || 12}am`}. About ${curve.gridKwhPerDay} kWh a day from the grid${curve.feedInKwhPerDay > 0 ? ` and ${curve.feedInKwhPerDay} kWh sent back` : ""}.`}>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--navy-accent-text, #2d3f9e)" stopOpacity="0.45" />
              <stop offset="1" stopColor="var(--navy-accent-text, #2d3f9e)" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f5a623" stopOpacity="0.55" />
              <stop offset="1" stopColor="#f5a623" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* peak window */}
          <rect x={x(pk0)} y={PAD.t} width={x(pk1) - x(pk0)} height={H - PAD.t - PAD.b} className={s.peakBand} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={s.gridLine} />
              <text x={PAD.l - 6} y={y(t) + 4} className={s.tick} textAnchor="end">{t}</text>
            </g>
          ))}
          {curve.feedInKwhPerDay > 0 && (
            <>
              <path d={area(feedPath, feedPts)} fill={`url(#${id}-f)`} className={s.areaIn} />
              <path d={feedPath} className={s.lineFeed} />
            </>
          )}
          <path key={`a-${key}`} d={area(gridPath, gridPts)} fill={`url(#${id}-g)`} className={s.areaIn} />
          <path key={`l-${key}`} d={gridPath} className={s.lineGrid} />
          <circle cx={x(peakH)} cy={y(curve.grid[peakH])} r={5} className={s.dot} />
          {HOURS.map((lab, i) => (
            <text key={lab} x={x(i * 3)} y={H - 8} className={s.tick} textAnchor={i === 0 ? "start" : "middle"}>{lab}</text>
          ))}
        </svg>
        <div className={s.stats}>
          <div><b>{curve.gridKwhPerDay.toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh</b><span>a day from the grid</span></div>
          {curve.feedInKwhPerDay > 0 && <div><b>{curve.feedInKwhPerDay.toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh</b><span>a day sent to the grid</span></div>}
          <div><b>{peakH > 12 ? `${peakH - 12}pm` : peakH === 12 ? "12pm" : peakH === 0 ? "12am" : `${peakH}am`}</b><span>busiest hour</span></div>
        </div>
        <p className={s.blurb}><b>{shapeInfo.title}.</b> {shapeInfo.blurb}</p>
        {note && <p className={s.note}>{note}</p>}
      </div>
    </section>
  );
}
