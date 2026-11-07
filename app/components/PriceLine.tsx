"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  items, you, youLabel, vdo, per, note,
}: {
  items: PriceLineItem[];
  you: number;
  youLabel: string;
  vdo?: number | null;
  /** e.g. "a month" */
  per: string;
  /** A short line about the usage behind the pin (replaces the "how to read it" text). */
  note?: ReactNode;
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
  // 7 Nov 2026: the line starts at $0, so distances are true to the money
  // ($67 sits at 70% of the way to $96, not at the far left). Before, it ran
  // from the cheapest plan to the bill, which stretched a $29 gap across the
  // whole width and made every result look like a chasm.
  const lo = 0;
  const hi = Math.max(...all);
  const span = Math.max(hi - lo, 1);
  const x = (v: number) => 4 + ((v - lo) / span) * 92;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const xs = sorted.map((i) => x(i.value));
  // On a phone the bubbles would pile up a dozen deep, so plans become small
  // dots and only the cheapest keeps its bubble; the list below has the rest.
  const compact = width < 520;
  const pct = (px: number) => (px / Math.max(width, 200)) * 100;
  const rawLane = compact ? lanes(xs, pct(DOT_PX)) : lanes(xs, pct(BUBBLE_PX));
  // Dots past the last lane start a new column a few pixels to the right, so
  // plans at the same price still each get their own dot.
  const lane = compact ? rawLane.map((l) => l % DOT_LANES) : rawLane;
  const nudge = compact ? rawLane.map((l) => Math.floor(l / DOT_LANES) * 7) : rawLane.map(() => 0);
  // Wide screens: on a true scale the plans bunch up, so only the cheapest
  // few keep a logo bubble (up to BUBBLE_ROWS deep) and the rest are dots
  // just above the line, like the phone view.
  const BUBBLE_ROWS = 3;
  const isBubble = compact ? sorted.map((it) => it === (sorted.find((i) => i.cheapest) ?? sorted[0])) : rawLane.map((l) => l < BUBBLE_ROWS);
  const dotIdx = sorted.map((_, i) => i).filter((i) => !isBubble[i]);
  const dotRaw = lanes(dotIdx.map((i) => xs[i]), pct(DOT_PX));
  const dotLane = new Map(dotIdx.map((i, k) => [i, compact ? dotRaw[k] % DOT_LANES : dotRaw[k] % DOT_LANES]));
  const dotNudge = new Map(dotIdx.map((i, k) => [i, Math.floor(dotRaw[k] / DOT_LANES) * 7]));
  const dotRows = dotIdx.length ? Math.max(...dotIdx.map((i) => dotLane.get(i)!)) + 1 : 0;
  const bubbleRows = compact ? 1 : Math.max(0, ...sorted.map((_, i) => (isBubble[i] ? lane[i] : -1))) + 1;
  const rows = compact ? dotRows : bubbleRows;
  const dotBand = dotRows * DOT_ROW + (dotRows ? 6 : 0);
  const base = compact ? ROW + dotBand + 8 : bubbleRows * ROW + dotBand + 8; // where the line sits
  // Round $ ticks along the line so the scale is explicit.
  const step = hi > 400 ? 100 : hi > 200 ? 50 : hi > 80 ? 20 : 10;
  const ticks: number[] = [];
  for (let v = 0; v <= hi; v += step) ticks.push(v);
  const cheaper = items.filter((i) => i.value < you - 0.005).length;
  const xYou = x(you);
  const xVdo = vdo ? x(vdo) : null;
  // The two labels under the line need about 150px between them.
  const vdoClash = xVdo !== null && Math.abs(xVdo - xYou) < (150 / Math.max(width, 200)) * 100;
  const who = youLabel.toLowerCase();
  // "Your bill" / "Your plan" is the customer; anything else (a typical plan) isn't.
  const allBeat = who.startsWith("your") ? "You pay more than every plan shown." : `Every plan shown costs less than ${who}.`;
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
        style={{ height: base + (vdoClash ? 88 : 60) }}
        role="img"
        aria-label={`${cheaper} of ${items.length} plans cost less than ${who} (${money(you)} ${per}).`}
      >
        <div className={s.track} style={{ top: base }} />
        {ticks.map((v) => (
          <span key={v} className={s.axisTick} style={{ left: `${x(v)}%`, top: base + 12 }} aria-hidden="true">{money(v)}</span>
        ))}
        {sorted.map((it, i) => (
          isBubble[i] ? null : (
            <span
              key={it.retailer + it.plan + i}
              className={s.dot}
              style={{ left: `calc(${xs[i]}% + ${nudge[i] + (dotNudge.get(i) ?? 0)}px)`, top: base - 4 - ((dotLane.get(i) ?? 0) + 1) * DOT_ROW }}
              title={it.locked ? `Plus members see this plan: ${money(it.value)} ${per}` : `${it.retailer}: ${it.plan}, ${money(it.value)} ${per}`}
            />
          )
        ))}
        {compact && (
          <div
            className={`${s.bubble} ${s.best}`}
            style={{ left: `${x(best.value)}%`, top: 0 }}
            title={best.locked ? `Plus members see this plan: ${money(best.value)} ${per}` : `${best.retailer}: ${best.plan}, ${money(best.value)} ${per}`}
          >
            <span className={s.face}>
              {best.locked ? <span className={s.lock}><Icon name="lock" size={16} /></span> : <RetailerLogo name={best.retailer} size={36} square />}
              <span className={s.star} aria-label="Cheapest">★</span>
            </span>
            <span className={s.price}>{money(best.value)}</span>
            <span className={s.stem} style={{ height: dotBand + 8 }} />
          </div>
        )}
        {!compact && sorted.map((it, i) => (
          !isBubble[i] ? null : (
            <div
              key={it.retailer + it.plan + i}
              className={`${s.bubble} ${it.cheapest ? s.best : ""}`}
              style={{ left: `${xs[i]}%`, top: (bubbleRows - 1 - lane[i]) * ROW, animationDelay: `${i * 60}ms` }}
              title={it.locked ? `Plus members see this plan: ${money(it.value)} ${per}` : `${it.retailer}: ${it.plan}, ${money(it.value)} ${per}`}
            >
              <span className={s.face}>
                {it.locked ? <span className={s.lock}><Icon name="lock" size={16} /></span> : <RetailerLogo name={it.retailer} size={36} square />}
                {it.cheapest && <span className={s.star} aria-label="Cheapest">★</span>}
              </span>
              <span className={s.price}>{money(it.value)}</span>
              <span className={s.stem} style={{ height: lane[i] * ROW + dotBand + 8 }} />
            </div>
          )
        ))}
        {xVdo !== null && vdo && (
          <>
            <span className={s.tick} style={{ left: `${xVdo}%`, top: base - 6 }} />
            <span className={s.vdoLabel} style={{ ...labelPos(xVdo), top: base + (vdoClash ? 60 : 30) }}>Default offer {money(vdo)}</span>
          </>
        )}
        <span className={s.pin} style={{ left: `${xYou}%`, top: base - 6 }} />
        <span className={s.youLabel} style={{ ...labelPos(xYou), top: base + 28 }}>
          <b>{youLabel}</b> {money(you)}
        </span>
      </div>
      {note ? (
        <figcaption className={s.caption}>
          <span className={s.status}>
            {cheaper === items.length
              ? <b className={s.bad}>{allBeat}</b>
              : cheaper === 0
                ? <b className={s.good}>Nothing shown beats {who}.</b>
                : <b>{cheaper} of {items.length} plans shown cost less than {who}.</b>}{" "}
            <span className={s.key}>★ cheapest · <i aria-hidden="true" /> {who}</span>
          </span>
          <span className={s.note}>{note}</span>
        </figcaption>
      ) : (
      <figcaption className={s.caption}>
        {compact ? (
          cheaper === items.length ? (
            <><b className={s.bad}>{allBeat}</b> Each dot is a plan at its price {per}, ★ the cheapest, the red pin {who}. Every plan is listed below.</>
          ) : cheaper === 0 ? (
            <><b className={s.good}>Nothing shown beats {who}.</b> Each dot is a plan at its price {per}.</>
          ) : (
            <><b>{cheaper} of {items.length} plans shown cost less than {who}.</b> Each dot is a plan at its price {per}, ★ the cheapest, the red pin {who}. Every plan is listed below.</>
          )
        ) : cheaper === items.length ? (
          <><b className={s.bad}>{allBeat}</b> Each bubble or dot is a plan at its price {per}, from $0; the red pin is {who}; ★ marks the cheapest.</>
        ) : cheaper === 0 ? (
          <><b className={s.good}>Nothing shown beats {who}.</b> Each bubble or dot is a plan at its price {per}, from $0.</>
        ) : (
          <><b>{cheaper} of {items.length} plans shown cost less than {who}.</b> Each bubble or dot is a plan at its price {per}, from $0; the red pin is {who}; ★ marks the cheapest.</>
        )}
      </figcaption>
      )}
    </figure>
  );
}
