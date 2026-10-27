"use client";

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import FunEquivalents from "./FunEquivalents";
import { OfferChips } from "./OfferTerms";
import { GAS_PLANS, GAS_PLAN_DATA_DATE, GAS_RETAILER_COUNT, GAS_ZONES, TYPICAL_MJ_PER_DAY, rankGasPlans, gasDataReady, type GasZone, type GasPlanRow, type RankedGas } from "@/lib/gasPlans";
import { describeOffer, topOpen } from "@/lib/planExtras";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { PERIOD_DAYS, periodScale, type PeriodName as Period } from "@/lib/periods";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import v from "./dashcompare.module.css";
import s from "./gasdash.module.css";
import pa from "./planaside.module.css";

// The gas side of My Dashboard: the same shape as electricity (verdict, your
// bill, retailer comparison with rates) in gas terms. Victoria has no default
// offer for gas, so "you now" is always the member's own gas bill.

export interface GasMember {
  gas_zone: string | null;
  gas_billing_days: number | null;
  gas_mj: number | null;
  gas_reference_total: number | null;
  gas_current_plan_name: string | null;
  gas_current_retailer?: string | null;
  gas_updated_at: string | null;
  /** The electricity best retailer, to suggest a dual-fuel question. */
  baseline_retailer?: string | null;
}

const PERIOD_LABEL: Record<Period, string> = { month: "a month", quarter: "a quarter", year: "a year" };
const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const c = (dollars: number, dp = 2) => `${(dollars * 100).toFixed(dp)}c`;

/** Supply and the stepped usage rates of a gas plan, in plain words. */
function GasRates({ plan, days }: { plan: GasPlanRow; days: number }) {
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

export default function GasDashboard({ member, isMember, period, onPeriod }: { member: GasMember; isMember: boolean; period: Period; onPeriod: (p: Period) => void }) {
  const zone = member.gas_zone && GAS_ZONES.includes(member.gas_zone as GasZone) ? (member.gas_zone as GasZone) : null;
  const days = member.gas_billing_days ?? 0;
  const mj = member.gas_mj ?? 0;
  const bill = member.gas_reference_total ?? null;
  const have = !!zone && days > 0 && mj > 0;
  const [allPlans, setAllPlans] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openRates, setOpenRates] = useState<string | null>(null);

  const gasOffer = (p: GasPlanRow) => describeOffer("G", p[0], p[2], p[1], { hasSolar: false, currentRetailer: member.gas_current_retailer ?? null });
  const ranked = useMemo<RankedGas[]>(() => (have && zone ? rankGasPlans(zone, { days, mj }, member.gas_current_retailer ?? null) : []), [have, zone, days, mj, member.gas_current_retailer]);
  const top = topOpen(ranked);
  const k = have ? periodScale(period, days) : 0;
  const you = bill; // Victoria has no gas default offer: the bill is the only "you now"
  const saving = you !== null && top ? you - top.total : 0;
  const savingYear = days > 0 ? (saving * 365) / days : 0;
  const verdict: "good" | "bad" | "nobill" = you === null ? "nobill" : savingYear >= WORTH_SWITCHING_PER_YEAR ? "bad" : "good";
  const severe = verdict === "bad" && you !== null && savingYear >= Math.max(250, (you * 365) / days * 0.15);

  // Cheapest per retailer, or every plan.
  const rows = useMemo(() => {
    const list = allPlans ? ranked : (() => { const seen = new Set<string>(); return ranked.filter((m) => (seen.has(m.plan[0]) ? false : (seen.add(m.plan[0]), true))); })();
    return showAll ? list : list.slice(0, 10);
  }, [ranked, allPlans, showAll]);
  const retailers = new Set(ranked.map((m) => m.plan[0])).size;

  if (!gasDataReady || GAS_PLANS.length === 0) {
    return (
      <section className={s.empty}>
        <span className={s.kicker}><Icon name="flame" size={14} /> Gas</span>
        <h2>Gas comparison is switching on.</h2>
        <p>Your gas details are saved; the comparison appears after our next gas price pull.</p>
      </section>
    );
  }

  if (!have) {
    return (
      <section className={s.empty}>
        <span className={s.kicker}><Icon name="flame" size={14} /> Gas</span>
        <h2>{isMember ? "Add a gas bill and we'll check it every morning, like electricity." : "Run the free gas check and your answer lands here."}</h2>
        <p>A gas-only bill or a dual-fuel bill both work: we read the network, the days and the megajoules. Victoria has no default offer for gas, so your own bill is the yardstick.</p>
        <div className={s.emptyBtns}>
          {isMember ? <a href="#savings" className={s.btnPrimary}>Upload a gas bill</a> : <Link href="/gas" className={s.btnPrimary}>Free gas check</Link>}
          <Link href="/gas" className={s.btnGhost}>How gas plans are priced</Link>
        </div>
      </section>
    );
  }

  const shown = Math.max(0, saving * k);
  const dual = top && member.baseline_retailer && top.plan[0] === member.baseline_retailer;

  return (
    <div className={s.wrap}>
      {/* Verdict: the same card as electricity, in gas colours */}
      <section className={`${v.verdict} ${s.hero} ${verdict === "good" ? v.good : severe ? v.severe : verdict === "bad" ? v.bad : ""}`}>
        <div className={v.verdictTop}>
          <span className={`${v.pill} ${s.gasPill}`}>
            <Icon name="flame" size={14} />{" "}
            {verdict === "nobill" ? "Gas: add your bill total for a verdict" : verdict === "good" ? "Gas: you're on a good deal" : severe ? "Gas: you're paying far more than you need to" : "Gas: you could pay less"}
          </span>
          <div className={v.toggle} role="tablist" aria-label="Show gas figures per" style={{ "--i": (Object.keys(PERIOD_DAYS) as Period[]).indexOf(period) } as CSSProperties}>
            <span className={v.thumb} aria-hidden="true" />
            {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? v.on : v.tbtn} onClick={() => onPeriod(p)}>
                {p === "month" ? "Monthly" : p === "quarter" ? "Quarterly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
        <h2 className={v.headline}>
          {verdict === "nobill"
            ? <>The cheapest gas plan for your usage is <span className={v.amount}>{top ? money(top.total * k) : "—"}</span> {PERIOD_LABEL[period]}</>
            : verdict === "good"
              ? "No gas plan beats yours by enough to bother."
              : <>You could save <span className={v.amount}>{whole(shown)}</span> {PERIOD_LABEL[period]} on gas</>}
        </h2>
        <div className={v.versus}>
          <div className={v.side} style={{ "--n": 0 } as CSSProperties}>
            <span className={v.sideLabel}>You now</span>
            <b>{member.gas_current_retailer ?? "Your gas plan"}</b>
            <span className={v.sidePlan}>{member.gas_current_plan_name ?? "from your gas bill"}</span>
            <span key={period} className={v.sideCost}>{you !== null ? money(you * k) : "—"}</span>
          </div>
          <div className={v.arrow} aria-hidden="true">→</div>
          <div className={`${v.side} ${v.sideBest}`} style={{ "--n": 1 } as CSSProperties}>
            <span className={v.sideLabel}>Cheapest gas plan we found</span>
            {top ? (
              <>
                <b>{top.plan[0]}</b>
                <span className={v.sidePlan}>{top.plan[2]}</span>
                <span key={period} className={v.sideCost}>{money(top.total * k)}</span>
                <span className={v.sideChips}><OfferChips o={gasOffer(top.plan)} /></span>
              </>
            ) : <b>No plan priced yet</b>}
          </div>
          {verdict === "bad" && top && (
            <>
              <div className={v.arrow} aria-hidden="true">=</div>
              <div className={`${v.side} ${v.sideSave}`} style={{ "--n": 2 } as CSSProperties}>
                <span className={v.sideLabel}>You save</span>
                <b>By switching gas</b>
                <span className={v.sidePlan}>{PERIOD_LABEL[period]}, to {top.plan[0]}</span>
                <span key={period} className={v.sideCost}>{money(saving * k)}</span>
              </div>
            </>
          )}
        </div>
        {verdict === "bad" && <FunEquivalents dollars={savingYear} />}
        <div className={v.verdictActions}>
          {top && verdict !== "good" && RETAILER_LINKS[top.plan[0]] && (
            <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={v.go}>Go to {top.plan[0]} →</a>
          )}
          {isMember && <a href="#savings" className={v.ghost}>Upload a newer gas bill</a>}
        </div>
        <p className={v.fine}>
          Priced today from your gas bill ({days}-day period, {Math.round(mj).toLocaleString("en-AU")} MJ, shown {PERIOD_LABEL[period]}), against {ranked.length} gas plans from {retailers} retailers on the {zone} network. Plan data {GAS_PLAN_DATA_DATE}.
          {dual ? ` ${top!.plan[0]} is also your cheapest electricity retailer: ask about a dual-fuel discount.` : ""}
        </p>
      </section>

      {/* Your gas bill */}
      <div className={`${v.youBox} ${s.youBox}`}>
        <div className={v.youMain}>
          <span className={v.youLabel}>Your gas bill</span>
          <span className={v.youCost}>{you !== null ? money(you * k) : "—"} <small>{PERIOD_LABEL[period]}</small></span>
        </div>
        <p className={v.youText}>
          About <b>{Math.round((mj / days) * 365).toLocaleString("en-AU")} MJ a year</b> ({Math.round(mj / days)} MJ a day; a typical Victorian home uses about {TYPICAL_MJ_PER_DAY}, more in winter)
          {member.gas_current_retailer ? <> with {member.gas_current_retailer}{member.gas_current_plan_name ? <>, &ldquo;{member.gas_current_plan_name}&rdquo;</> : null}</> : null}.
          {" "}Victoria has no government default offer for gas, so your own bill is what every plan is measured against.
        </p>
      </div>

      {/* Retailer comparison */}
      <section className={v.table}>
        <div className={v.tableHead}>
          <h3 className={s.h3}>Gas retailer comparison</h3>
          <p className={s.sub}>Each retailer&apos;s cheapest gas plan for your usage on the {zone} network, cheapest first, {PERIOD_LABEL[period]}. Tap a retailer to visit their website.</p>
          <div className={s.viewToggle} role="tablist">
            <button type="button" role="tab" aria-selected={!allPlans} className={!allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(false); setShowAll(false); }}>Cheapest per retailer <em>{retailers}</em></button>
            <button type="button" role="tab" aria-selected={allPlans} className={allPlans ? s.vOn : s.vBtn} onClick={() => { setAllPlans(true); setShowAll(false); }}>All plans <em>{ranked.length}</em></button>
          </div>
        </div>
        <div className={v.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th className={v.num}>Cost {PERIOD_LABEL[period]}</th><th className={v.num}>vs your bill</th></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const key = `${m.plan[0]}|${m.plan[2]}`;
                const diff = you !== null ? (you - m.total) * k : null;
                const mine = member.gas_current_retailer && m.plan[0] === member.gas_current_retailer;
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
                        {m.restricted && <span className={s.restricted}>! {m.restricted}</span>}
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
            const mine = member.gas_current_retailer && m.plan[0] === member.gas_current_retailer;
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
                  {m.restricted && <span className={s.restricted}>! {m.restricted}</span>}
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
    </div>
  );
}

/** The side-column card for gas: your gas plan now, and the cheapest we found. */
export function GasAside({ member }: { member: GasMember }) {
  const zone = member.gas_zone && GAS_ZONES.includes(member.gas_zone as GasZone) ? (member.gas_zone as GasZone) : null;
  const days = member.gas_billing_days ?? 0;
  const mj = member.gas_mj ?? 0;
  if (!zone || !(days > 0) || !(mj > 0)) return null;
  const best = gasDataReady ? topOpen(rankGasPlans(zone, { days, mj }, member.gas_current_retailer ?? null)) : undefined;
  return (
    <section className={pa.card} aria-label="Your gas plan now">
      <div className={pa.head}>
        <RetailerLogo name={member.gas_current_retailer ?? null} size={48} />
        <div className={pa.headText}>
          <span className={pa.kicker}><Icon name="flame" size={11} /> Your gas plan now</span>
          <b>{member.gas_current_retailer ?? "Your gas retailer"}</b>
          <span>{member.gas_current_plan_name ?? "Plan name from your next bill"}</span>
        </div>
      </div>
      <dl className={pa.rows}>
        <div className={pa.row}><dt>Network</dt><dd>{zone}</dd></div>
        <div className={pa.row}><dt>Usage</dt><dd>{Math.round(mj / days)} MJ a day</dd></div>
        {member.gas_reference_total !== null && <div className={pa.row}><dt>Last bill</dt><dd>{money(member.gas_reference_total)} / {days} days</dd></div>}
        {best && <div className={pa.row}><dt>Cheapest we found</dt><dd>{best.plan[0]}<br /><small>{money(best.total)} for the same period</small></dd></div>}
      </dl>
    </section>
  );
}
