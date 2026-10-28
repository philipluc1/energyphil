"use client";

import { Fragment, useMemo, useState } from "react";
import RetailerLogo from "./RetailerLogo";
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

/** Supply and the stepped usage rates of a gas plan, in plain words. */
export function GasRates({ plan, days }: { plan: GasPlanRow; days: number }) {
  const [, , , , supply, blocks, perDay] = plan;
  return (
    <table className={s.rates}>
      <tbody>
        <tr><th scope="row">Supply charge<small>c a day</small></th><td>{c(supply)}</td></tr>
        {blocks.map((b, i) => {
          const prev = i === 0 ? 0 : blocks[i - 1].upTo ?? 0;
          const label = b.upTo === null ? (i === 0 ? "All usage" : `Over ${prev.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}`) : i === 0 ? `First ${b.upTo.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}` : `${prev.toLocaleString("en-AU")} to ${b.upTo.toLocaleString("en-AU")} MJ${perDay ? " a day" : ""}`;
          return <tr key={i}><th scope="row">{label}<small>c per MJ</small></th><td>{c(b.rate, 3)}</td></tr>;
        })}
        {perDay && <tr><td colSpan={2} className={s.ratesNote}>Usage steps are per day, scaled to your {days}-day bill.</td></tr>}
      </tbody>
    </table>
  );
}

export default function GasPlanTable({
  ranked, days, mj, k, you, youLabel, perLabel, zone, currentRetailer, chart = true,
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
}) {
  const [allPlans, setAllPlans] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openRates, setOpenRates] = useState<string | null>(null);
  const gasOffer = (p: GasPlanRow) => describeOffer("G", p[0], p[2], p[1], { hasSolar: false, currentRetailer });
  const top = topOpen(ranked);
  const perRetailer = useMemo(() => { const seen = new Set<string>(); return ranked.filter((m) => (seen.has(m.plan[0]) ? false : (seen.add(m.plan[0]), true))); }, [ranked]);
  const rows = useMemo(() => { const list = allPlans ? ranked : perRetailer; return showAll ? list : list.slice(0, 10); }, [ranked, perRetailer, allPlans, showAll]);
  const retailers = perRetailer.length;

  return (
    <>
      {chart && you !== null && perRetailer.length > 0 && (
        <div className={v.chart}>
          <PriceLine
            items={perRetailer.slice(0, 8).map((m) => ({ retailer: m.plan[0], plan: m.plan[2], value: m.total * k, cheapest: m === top }))}
            you={you * k}
            youLabel={youLabel}
            vdo={null}
            per={perLabel}
          />
        </div>
      )}
      <section className={v.table}>
        <div className={v.tableHead}>
          <h3 className={s.h3}>Gas retailer comparison</h3>
          <p className={s.sub}>Each retailer&apos;s cheapest gas plan for your usage on the {zone} network, cheapest first, {perLabel}. Tap a retailer to visit their website.</p>
          <div className={s.viewToggle} role="tablist">
            <button type="button" role="tab" aria-selected={!allPlans} className={!allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(false); setShowAll(false); }}>Cheapest per retailer <em>{retailers}</em></button>
            <button type="button" role="tab" aria-selected={allPlans} className={allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(true); setShowAll(false); }}>All plans <em>{ranked.length}</em></button>
          </div>
        </div>
        <div className={v.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th className={v.num}>Cost {perLabel}</th><th className={v.num}>vs your bill</th></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const key = `${m.plan[0]}|${m.plan[2]}`;
                const diff = you !== null ? (you - m.total) * k : null;
                const mine = currentRetailer && m.plan[0] === currentRetailer;
                return (
                  <Fragment key={key + i}>
                    <tr className={m === top ? v.rowBest : mine ? v.rowMine : ""}>
                      <td>{i + 1}</td>
                      <td>
                        <span className={v.retailerCell}>
                          <RetailerLogo name={m.plan[0]} size={28} />
                          {RETAILER_LINKS[m.plan[0]] ? <a href={RETAILER_LINKS[m.plan[0]]} target="_blank" rel="noopener noreferrer" className={s.rlink}>{m.plan[0]} ↗</a> : <b>{m.plan[0]}</b>}
                        </span>
                        {m === top && <span className={v.tagBest}>{i === 0 ? "Cheapest" : "Cheapest you can get"}</span>}
                        {mine && <span className={v.tagMine}>Your retailer</span>}
                      </td>
                      <td className={v.planName}>
                        {m.plan[2]}
                        <span className={v.offerChips}><OfferChips o={gasOffer(m.plan)} /></span>
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
                            <GasRates plan={m.plan} days={days} />
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
              <li key={key + i} className={`${v.pc} ${m === top ? v.rowBest : mine ? v.rowMine : ""}`}>
                <span className={v.pcRank}>{i + 1}</span>
                <div className={v.pcMain}>
                  <div className={v.pcTop}>
                    <RetailerLogo name={m.plan[0]} size={26} />
                    <b>{m.plan[0]}</b>
                    {m === top && <span className={v.tagBest}>{i === 0 ? "Cheapest" : "Best you can get"}</span>}
                    {mine && <span className={v.tagMine}>Yours</span>}
                  </div>
                  <span className={v.pcPlan}>{m.plan[2]}</span>
                  <span className={v.offerChips}><OfferChips o={gasOffer(m.plan)} /></span>
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
                    <GasRates plan={m.plan} days={days} />
                    <p className={v.ratesFine}>Published rates including GST, before any discounts.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {(allPlans ? ranked.length : retailers) > 10 && (
          <button type="button" className={v.more} onClick={() => setShowAll((x) => !x)}>
            {showAll ? "Show the top 10" : allPlans ? `Show all ${ranked.length} plans` : `Show all ${retailers} retailers`}
          </button>
        )}
        <p className={v.fineDark}>
          Gas prices from the retailers&apos; published offers for the {zone} network (we track {GAS_RETAILER_COUNT} gas retailers), priced on your {Math.round(mj).toLocaleString("en-AU")} MJ over {days} days, including GST and each plan&apos;s guaranteed and pay-on-time discounts. Estimates only; confirm with the retailer before switching.
        </p>
      </section>
    </>
  );
}
