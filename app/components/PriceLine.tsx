"use client";

import { useEffect, useRef, useState } from "react";
import RetailerLogo from "./RetailerLogo";
import Icon from "./Icon";
import s from "./priceline.module.css";

// The retailer comparison as one price line: cheaper on the left, dearer on
// the right. Each plan is a retailer bubble sitting at its price; a red pin
// shows where the customer's bill sits, and a grey tick the default offer.
// Simpler to read than a bar chart: "how far left of me are the plans?"

export interface PriceLineItem {
  retailer: string;
  plan: string;
  value: number;
  /** Members only: the bubble shows a lock instead of the retailer. */
  locked?: boolean;
  cheapest?: boolean;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const BUBBLE_PX = 58; // bubble width plus a little air
const ROW = 70;
const DOT_PX = 13; // a dot plus a little air, for phones
const DOT_ROW = 16;
const DOT_LANES = 8;

/** Spread bubbles into rows above the line so none overlap (x in %). */
function lanes(xs: number[], gap: number): number[] {
  const last: number[] = [];
  return xs.map((x) => {
    let lane = last.findIndex((l) => x - l >= gap);
    if (lane === -1) { lane = last.length; last.push(x); } else last[lane] = x;
    return lane;
  });
}

/** Keep a label inside the plot: centred on x, or pinned to an edge near the ends. */
const labelPos = (x: number) => (x > 80 ? { right: 0 } : x < 20 ? { left: 0 } : { left: `${x}%`, transform: "translateX(-50%)" });

export default function PriceLine({
  items, you, youLabel, vdo, per,
}: {
  items: PriceLineItem[];
  you: number;
  youLabel: string;
  vdo?: number | null;
  /** e.g. "a month" */
  per: string;
}) {
  // Bubbles need more room (in %) on a narrow screen.
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!items.length) return null;
  const all = [...items.map((i) => i.value), you, ...(vdo ? [vdo] : [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(hi - lo, 1);
  const x = (v: number) => 4 + ((v - lo) / span) * 92;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const xs = sorted.map((i) => x(i.value));
  // On a phone the bubbles would pile up a dozen deep, so plans become small
  // dots and only the cheapest keeps its bubble; the list below has the rest.
  const compact = width < 520;
  const rawLane = compact ? lanes(xs, (DOT_PX / Math.max(width, 200)) * 100) : lanes(xs, (BUBBLE_PX / Math.max(width, 200)) * 100);
  // Dots past the last lane start a new column a few pixels to the right, so
  // plans at the same price still each get their own dot.
  const lane = compact ? rawLane.map((l) => l % DOT_LANES) : rawLane;
  const nudge = compact ? rawLane.map((l) => Math.floor(l / DOT_LANES) * 7) : rawLane.map(() => 0);
  const rows = Math.max(...lane) + 1;
  const base = compact ? ROW + rows * DOT_ROW + 8 : rows * ROW + 8; // where the line sits
  const cheaper = items.filter((i) => i.value < you - 0.005).length;
  const xYou = x(you);
  const xVdo = vdo ? x(vdo) : null;
  // The two labels under the line need about 150px between them.
  const vdoClash = xVdo !== null && Math.abs(xVdo - xYou) < (150 / Math.max(width, 200)) * 100;
  const who = youLabel.toLowerCase();
  const best = sorted.find((i) => i.cheapest) ?? sorted[0];

  return (
    <figure className={s.wrap}>
      <div className={s.scale} aria-hidden="true">
        <span>Cheaper</span>
        <span>Dearer</span>
      </div>
      <div
        ref={ref}
        className={s.plot}
        style={{ height: base + (vdoClash ? 78 : 50) }}
        role="img"
        aria-label={`${cheaper} of ${items.length} plans cost less than ${who} (${money(you)} ${per}).`}
      >
        <div className={s.track} style={{ top: base }} />
        {compact && sorted.map((it, i) => (
          it === best ? null : (
            <span
              key={it.retailer + it.plan + i}
              className={s.dot}
              style={{ left: `calc(${xs[i]}% + ${nudge[i]}px)`, top: base - 4 - (lane[i] + 1) * DOT_ROW }}
              title={it.locked ? `Members see this plan: ${money(it.value)} ${per}` : `${it.retailer}: ${it.plan}, ${money(it.value)} ${per}`}
            />
          )
        ))}
        {compact && (
          <div
            className={`${s.bubble} ${s.best}`}
            style={{ left: `${x(best.value)}%`, top: 0 }}
            title={best.locked ? `Members see this plan: ${money(best.value)} ${per}` : `${best.retailer}: ${best.plan}, ${money(best.value)} ${per}`}
          >
            <span className={s.face}>
              {best.locked ? <span className={s.lock}><Icon name="lock" size={16} /></span> : <RetailerLogo name={best.retailer} size={36} square />}
              <span className={s.star} aria-label="Cheapest">★</span>
            </span>
            <span className={s.price}>{money(best.value)}</span>
            <span className={s.stem} style={{ height: rows * DOT_ROW + 8 }} />
          </div>
        )}
        {!compact && sorted.map((it, i) => (
          <div
            key={it.retailer + it.plan + i}
            className={`${s.bubble} ${it.cheapest ? s.best : ""}`}
            style={{ left: `${xs[i]}%`, top: (rows - 1 - lane[i]) * ROW, animationDelay: `${i * 60}ms` }}
            title={it.locked ? `Members see this plan: ${money(it.value)} ${per}` : `${it.retailer}: ${it.plan}, ${money(it.value)} ${per}`}
          >
            <span className={s.face}>
              {it.locked ? <span className={s.lock}><Icon name="lock" size={16} /></span> : <RetailerLogo name={it.retailer} size={36} square />}
              {it.cheapest && <span className={s.star} aria-label="Cheapest">★</span>}
            </span>
            <span className={s.price}>{money(it.value)}</span>
            <span className={s.stem} style={{ height: lane[i] * ROW + 8 }} />
          </div>
        ))}
        {xVdo !== null && vdo && (
          <>
            <span className={s.tick} style={{ left: `${xVdo}%`, top: base - 6 }} />
            <span className={s.vdoLabel} style={{ ...labelPos(xVdo), top: base + (vdoClash ? 50 : 20) }}>Default offer {money(vdo)}</span>
          </>
        )}
        <span className={s.pin} style={{ left: `${xYou}%`, top: base - 6 }} />
        <span className={s.youLabel} style={{ ...labelPos(xYou), top: base + 18 }}>
          <b>{youLabel}</b> {money(you)}
        </span>
      </div>
      <figcaption className={s.caption}>
        {compact ? (
          cheaper === items.length ? (
            <><b className={s.bad}>You pay more than every plan shown.</b> Each dot is a plan at its price {per}, ★ the cheapest, the red pin {who}. Every plan is listed below.</>
          ) : cheaper === 0 ? (
            <><b className={s.good}>Nothing shown beats {who}.</b> Each dot is a plan at its price {per}.</>
          ) : (
            <><b>{cheaper} of {items.length} plans shown cost less than {who}.</b> Each dot is a plan at its price {per}, ★ the cheapest, the red pin {who}. Every plan is listed below.</>
          )
        ) : cheaper === items.length ? (
          <><b className={s.bad}>You pay more than every plan shown.</b> Each bubble is a plan at its price {per}; the red pin is {who}; ★ marks the cheapest.</>
        ) : cheaper === 0 ? (
          <><b className={s.good}>Nothing shown beats {who}.</b> Each bubble is a plan at its price {per}.</>
        ) : (
          <><b>{cheaper} of {items.length} plans shown cost less than {who}.</b> Each bubble is a plan at its price {per}; the red pin is {who}; ★ marks the cheapest.</>
        )}
      </figcaption>
    </figure>
  );
}
