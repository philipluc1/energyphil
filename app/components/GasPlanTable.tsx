"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import RetailerLogo from "./RetailerLogo";
import ComplaintBadge from "./ComplaintBadge";
import PriceLine from "./PriceLine";
import { OfferChips } from "./OfferTerms";
import { GAS_RETAILER_COUNT, type GasPlanRow, type RankedGas } from "@/lib/gasPlans";
import { describeOffer, topOpen } from "@/lib/planExtras";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import v from "./dashcompare.module.css";
import s from "./gasdash.module.css";

// The gas retailer comparison, the same shape as electricity's: a price line
// (cheapest per retailer as bubbles, the customer as the red pin), then the
// table with logos, offer chips, "See rates" and a cheapest-per-retailer /
// all-plans toggle. Used on the free gas check and the gas dashboard.

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const c = (dollars: number, dp = 2) => `${(dollars * 100).toFixed(dp)}c`;

/** The rates off the member's own gas bill, in dollars (supply $/day, usage $/MJ). */
export type YourGasRates = { supply: number | null; usage: number | null; label?: string } | null;

/**
 * Supply and the stepped usage rates of a gas plan, in plain words. With `yours`
 * (7 Nov 2026) it's "Your bill" beside the plan, with a tick on the better rate,
 * the same as the electricity rows.
 */
export function GasRates({ plan, days, yours, planLabel }: { plan: GasPlanRow; days: number; yours?: YourGasRates; planLabel?: string }) {
  const [, , , , supply, blocks, perDay] = plan;
  const cmp = !!(yours && (yours.supply !== null || yours.usage !== null));
  const tick = (mine: number | null, theirs: number) => mine === null ? "" : mine < theirs ? s.win : mine > theirs ? "" : "";
  return (
    <table className={`${s.rates} ${cmp ? s.ratesCmp : ""}`}>
      {cmp && (
        <thead>
          <tr><th scope="col"><span className={s.srOnly}>Rate</span></th><th scope="col">{yours?.label ?? "Your bill"}</th><th scope="col">{planLabel ?? "This plan"}</th></tr>
        </thead>
      )}
      <tbody>
        <tr>
          <th scope="row">Supply charge<small>c a day</small></th>
          {cmp && <td className={tick(yours!.supply, supply)}>{yours!.supply !== null ? c(yours!.supply) : "—"}</td>}
          <td className={cmp && yours!.supply !== null && supply < yours!.supply ? s.win : ""}>{c(supply)}</td>
        </tr>
        {blocks.map((b, i) => {
          const prev = i === 0 ? 0 : blocks[i - 1].upTo ?? 0;
          const label = b.upTo === null ? (i === 0 ? "All usage" : `Over ${prev.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}`) : i === 0 ? `First ${b.upTo.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}` : `${prev.toLocaleString("en-AU")} to ${b.upTo.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}`;
          return (
            <tr key={i}>
              <th scope="row">{label}<small>c per MJ</small></th>
              {cmp && <td className={i === 0 ? tick(yours!.usage, b.rate) : ""}>{i === 0 && yours!.usage !== null ? c(yours!.usage, 3) : i === 0 ? "—" : ""}</td>}
              <td className={cmp && i === 0 && yours!.usage !== null && b.rate < yours!.usage ? s.win : ""}>{c(b.rate, 3)}</td>
            </tr>
          );
        })}
        {perDay && <tr><td colSpan={cmp ? 3 : 2} className={s.ratesNote}>Usage steps are per day, scaled to your {days}-day bill.</td></tr>}
        {cmp && <tr><td colSpan={3} className={s.ratesNote}>Your bill&apos;s usage rate is its first step. ✓ marks the better rate.</td></tr>}
      </tbody>
    </table>
  );
}

export default function GasPlanTable({
  ranked, days, mj, k, you, youLabel, perLabel, zone, currentRetailer, chart = true, controls, note, yourRates = null,
}: {
  ranked: RankedGas[];
  days: number;
  mj: number;
  /** Scale from the bill period to the period shown (1 = as billed). */
  k: number;
  /** What they pay now for the same period, or null when we don't know their bill. */
  you: number | null;
  /** "Your bill", "A typical plan". */
  youLabel: string;
  /** "a year", "for these 91 days". */
  perLabel: string;
  zone: string;
  currentRetailer: string | null;
  chart?: boolean;
  /** Extra controls under the heading (the dashboard's what-if bar). */
  controls?: ReactNode;
  /** The usage line under the price chart. */
  note?: ReactNode;
  /** The rates off their own bill, shown beside each plan's rates (7 Nov 2026). */
  yourRates?: YourGasRates;
}) {
  const [allPlans, setAllPlans] = useState(false);
  // Top 6, then 10 more, then everything (same as electricity).
  const [shownCount, setShownCount] = useState(6);
  const [openRates, setOpenRates] = useState<string | null>(null);
  const gasOffer = (p: GasPlanRow) => describeOffer("G", p[0], p[2], p[1], { hasSolar: false, currentRetailer });
  const top = topOpen(ranked);
  // One row per retailer: its cheapest plan, except that the cheapest plan anyone can get stands in for its
  // retailer when that retailer's cheapest is limited (e.g. only with their electricity), so our pick is in the list.
  const perRetailer = useMemo(() => {
    const seen = new Set<string>();
    const first = ranked.filter((m) => (seen.has(m.plan[0]) ? false : (seen.add(m.plan[0]), true)));
    return top ? first.map((m) => (m.plan[0] === top.plan[0] ? top : m)).sort((a, b) => a.total - b.total) : first;
  }, [ranked, top]);
  const list = allPlans ? ranked : perRetailer;
  const rows = useMemo(() => list.slice(0, shownCount), [list, shownCount]);
  const retailers = perRetailer.length;
  // Our pick: the cheapest plan anyone can get, when it beats what they pay. Boxed in the list, with a bubble.
  const pickYear = top && you !== null && days > 0 ? (you - top.total) * (365 / days) : 0;
  const pick = top && pickYear >= 1 ? top : null;

  return (
    <>
      <section className={v.table}>
        <div className={v.tableHead}>
          <h3 className={s.h3}>Gas retailer comparison</h3>
          <div className={s.viewToggle} role="tablist">
            <button type="button" role="tab" aria-selected={!allPlans} className={!allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(false); setShownCount(6); }}>Cheapest per retailer <em>{retailers}</em></button>
            <button type="button" role="tab" aria-selected={allPlans} className={allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(true); setShownCount(6); }}>All plans <em>{ranked.length}</em></button>
          </div>
        </div>
        {chart && you !== null && perRetailer.length > 0 && (
          <div className={v.chart}>
            <PriceLine
              items={perRetailer.slice(0, 8).map((m) => ({ retailer: m.plan[0], plan: m.plan[2], value: m.total * k, cheapest: m === top }))}
              you={you * k}
              youLabel={youLabel}
              vdo={null}
              per={perLabel}
              note={note}
            />
          </div>
        )}
        {controls}
        <div className={v.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th className={v.num}>Cost {perLabel}</th><th className={v.num}>vs {youLabel.toLowerCase()}</th></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const key = `${m.plan[0]}|${m.plan[2]}`;
                const diff = you !== null ? (you - m.total) * k : null;
                const mine = currentRetailer && m.plan[0] === currentRetailer;
                return (
                  <Fragment key={key + i}>
                    <tr className={`${m === top ? v.rowBest : mine ? v.rowMine : ""} ${m === pick ? v.rowPick : ""}`}>
                      <td>{i + 1}</td>
                      <td>
                        {m === pick && <span className={v.pickBubble}>Our pick</span>}
                        <span className={v.retailerCell}>
                          <RetailerLogo name={m.plan[0]} size={28} />
                          {RETAILER_LINKS[m.plan[0]] ? <a href={RETAILER_LINKS[m.plan[0]]} target="_blank" rel="noopener noreferrer" className={s.rlink}>{m.plan[0]} ↗</a> : <b>{m.plan[0]}</b>}
                        </span>
                        {m === top && m !== pick && <span className={v.tagBest}>{i === 0 ? "Cheapest" : "Cheapest you can get"}</span>}
                        {mine && <span className={v.tagMine}>Your retailer</span>}
                      </td>
                      <td className={v.planName}>
                        {m.plan[2]}
                        <span className={v.offerChips}><OfferChips o={gasOffer(m.plan)} /><ComplaintBadge retailer={m.plan[0]} /></span>
                        <br />
                        <button type="button" className={v.ratesToggle} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                          {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                        </button>
                      </td>
                      <td className={v.num}>{money(m.total * k)}</td>
                      <td className={`${v.num} ${diff === null ? v.flat : diff >= 0 ? v.pos : v.neg}`}>{diff === null ? "—" : diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                    </tr>
                    {openRates === key && (
                      <tr className={v.ratesDetailRow}>
                        <td colSpan={5}>
                          <div className={v.ratesDetail}>
                            <GasRates plan={m.plan} days={days} yours={yourRates} planLabel={m.plan[0]} />
                            <p className={v.ratesFine}>Published rates including GST, before any discounts.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <ol className={v.cards}>
          {rows.map((m, i) => {
            const key = `${m.plan[0]}|${m.plan[2]}`;
            const diff = you !== null ? (you - m.total) * k : null;
            const mine = currentRetailer && m.plan[0] === currentRetailer;
            return (
              <li key={key + i} className={`${v.pc} ${m === top ? v.rowBest : mine ? v.rowMine : ""} ${m === pick ? v.rowPick : ""}`}>
                {m === pick && <span className={v.pickBubble}>Our pick</span>}
                <span className={v.pcRank}>{i + 1}</span>
                <div className={v.pcMain}>
                  <div className={v.pcTop}>
                    <RetailerLogo name={m.plan[0]} size={26} />
                    <b>{m.plan[0]}</b>
                    {m === top && m !== pick && <span className={v.tagBest}>{i === 0 ? "Cheapest" : "Best you can get"}</span>}
                    {mine && <span className={v.tagMine}>Yours</span>}
                  </div>
                  <span className={v.pcPlan}>{m.plan[2]}</span>
                  <span className={v.offerChips}><OfferChips o={gasOffer(m.plan)} /><ComplaintBadge retailer={m.plan[0]} /></span>
                </div>
                <div className={v.pcNums}>
                  <b>{whole(m.total * k)}</b>
                  {diff !== null && <span className={diff >= 0 ? v.pos : v.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>}
                </div>
                <button type="button" className={`${v.ratesToggle} ${v.pcRates}`} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                  {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                </button>
                {openRates === key && (
                  <div className={`${v.ratesDetail} ${v.pcRatesDetail}`}>
                    <GasRates plan={m.plan} days={days} yours={yourRates} planLabel={m.plan[0]} />
                    <p className={v.ratesFine}>Published rates including GST, before any discounts.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {list.length > 6 && (
          <div className={v.moreRow}>
            {shownCount < list.length && shownCount < 16 && list.length > 16 && (
              <button type="button" className={v.more} onClick={() => setShownCount(16)}>Show the next {Math.min(10, list.length - shownCount)} ▾</button>
            )}
            {shownCount < list.length && (
              <button type="button" className={v.more} onClick={() => setShownCount(list.length)}>{allPlans ? `Show all ${list.length} plans` : `Show all ${list.length} retailers`} ▾</button>
            )}
            {shownCount > 6 && (
              <button type="button" className={v.more} onClick={() => setShownCount(6)}>Show the top 6 ▴</button>
            )}
          </div>
        )}
        <details className={v.legendBox}>
          <summary>How we priced these</summary>
          <p className={v.fineDark}>
          Each retailer&apos;s cheapest gas plan on the {zone} network, cheapest first. Gas prices from the retailers&apos; published offers for the {zone} network (we track {GAS_RETAILER_COUNT} gas retailers), priced on your {Math.round(mj).toLocaleString("en-AU")} MJ over {days} days, including GST and each plan&apos;s guaranteed and pay-on-time discounts. Estimates only; confirm with the retailer before switching.
          </p>
        </details>
      </section>
    </>
  );
}
