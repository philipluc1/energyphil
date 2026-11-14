"use client";

import type { ReactNode } from "react";
import RetailerLogo from "./RetailerLogo";
import Icon from "./Icon";
import s from "./rankedbars.module.css";

// 14 Nov 2026 (Phil: the dot chart was hard to read). Each retailer's best
// plan as a bar, cheapest first, with your bill pinned where it ranks and the
// default offer as a dashed line. Readable in two seconds.

export interface RankedItem { retailer: string; plan: string; value: number; locked?: boolean; pick?: boolean }

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

export default function RankedBars({ items, you, youLabel, vdo, per, unit, note, show = 6, them: themText }: {
  /** Cheapest first: the whole list, so the rank is right. */
  items: RankedItem[];
  you: number;
  youLabel: string;
  vdo: number | null;
  per: string;
  /** "retailers' best plans" or "plans". */
  unit: string;
  note?: ReactNode;
  show?: number;
  /** How the sentence names what they pay ("your bill", "a typical plan"). */
  them?: string;
}) {
  if (!items.length) return null;
  const cheaper = items.filter((i) => i.value < you - 0.005).length;
  const rank = cheaper + 1;
  const top = items.slice(0, show);
  const youInTop = rank <= show;
  const shownValues = [...top.map((i) => i.value), you, ...(vdo ? [vdo] : [])];
  // Bars start a little under the cheapest shown, so a $50 gap is visible (the dollar figures carry the exact amounts).
  const max = Math.max(...shownValues) * 1.02;
  const min = Math.min(...shownValues) * 0.8;
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  const w = (v: number) => `${Math.max(4, at(v))}%`;
  const vdoAt = vdo ? `${at(vdo)}%` : null;
  const them = themText ?? (youLabel === "Default offer" ? "the default offer" : youLabel === "Your plan" ? "your plan" : "your bill");

  const youRow = (
    <li key="you" className={`${s.row} ${s.you}`}>
      <span className={s.rank}>#{rank}</span>
      <span className={s.who}>
        <span className={s.youDot} aria-hidden="true" />
        <span className={s.names}><b>{youLabel}</b><small>you now</small></span>
      </span>
      <span className={s.track}>{vdoAt && <i className={s.vdo} style={{ left: vdoAt }} aria-hidden="true" />}<span className={s.bar} style={{ width: w(you) }} /></span>
      <span className={s.val}>{whole(you)}</span>
    </li>
  );

  const rows: ReactNode[] = [];
  top.forEach((i, n) => {
    if (youInTop && n === cheaper) rows.push(youRow);
    rows.push(
      <li key={`${i.retailer}|${i.plan}`} className={`${s.row} ${i.pick ? s.pick : ""}`}>
        <span className={s.rank}>#{n + 1 + (youInTop && n >= cheaper ? 0 : 0)}</span>
        <span className={s.who}>
          {i.locked ? <span className={s.lock}><Icon name="lock" size={14} /></span> : <RetailerLogo name={i.retailer} size={28} square />}
          <span className={s.names}>
            <b>{i.locked ? "Plus members see" : i.retailer}{i.pick ? <span className={s.pickTag}>Our pick</span> : null}</b>
            <small>{i.locked ? "Retailer and plan hidden" : i.plan}</small>
          </span>
        </span>
        <span className={s.track}>{vdoAt && <i className={s.vdo} style={{ left: vdoAt }} aria-hidden="true" />}<span className={s.bar} style={{ width: w(i.value) }} /></span>
        <span className={s.val}>{whole(i.value)}</span>
      </li>,
    );
  });
  if (youInTop && cheaper >= top.length) rows.push(youRow);
  if (!youInTop) {
    rows.push(<li key="gap" className={s.gap}>{rank - 1 - top.length > 0 ? `… ${rank - 1 - top.length} more ${unit} cheaper than you` : "…"}</li>);
    rows.push(youRow);
  }

  return (
    <div className={s.wrap}>
      <p className={s.head}>
        <span>
          {cheaper === 0
            ? <><b>Nothing here beats {them}.</b></>
            : cheaper >= items.length
              ? <><b>All {items.length} {unit}</b> are cheaper than {them}.</>
              : <><b>{cheaper} of {items.length} {unit}</b> are cheaper than {them}.</>}
        </span>
        <span className={s.per}>Cost {per}</span>
      </p>
      <ol className={s.list}>{rows}</ol>
      {vdo ? <p className={s.legend}><i className={s.vdoKey} aria-hidden="true" /> Default offer {whole(vdo)} {per}, the government&apos;s reference price</p> : null}
      {note ? <p className={s.note}>{note}</p> : null}
    </div>
  );
}
