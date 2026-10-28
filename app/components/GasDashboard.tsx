"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import FunEquivalents from "./FunEquivalents";
import GasPlanTable from "./GasPlanTable";
import GasSeasonChart from "./GasSeasonChart";
import { annualFromGasBill, heatingShareFor, monthsFromAnnual } from "@/lib/gasUsage";
import { OfferChips } from "./OfferTerms";
import { GAS_PLANS, GAS_PLAN_DATA_DATE, GAS_ZONES, TYPICAL_MJ_PER_DAY, rankGasPlans, gasDataReady, type GasZone, type GasPlanRow, type RankedGas } from "@/lib/gasPlans";
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

export default function GasDashboard({ member, isMember, period, onPeriod }: { member: GasMember; isMember: boolean; period: Period; onPeriod: (p: Period) => void }) {
  const zone = member.gas_zone && GAS_ZONES.includes(member.gas_zone as GasZone) ? (member.gas_zone as GasZone) : null;
  const days = member.gas_billing_days ?? 0;
  const mj = member.gas_mj ?? 0;
  const bill = member.gas_reference_total ?? null;
  const have = !!zone && days > 0 && mj > 0;

  const gasOffer = (p: GasPlanRow) => describeOffer("G", p[0], p[2], p[1], { hasSolar: false, currentRetailer: member.gas_current_retailer ?? null });
  const ranked = useMemo<RankedGas[]>(() => (have && zone ? rankGasPlans(zone, { days, mj }, member.gas_current_retailer ?? null) : []), [have, zone, days, mj, member.gas_current_retailer]);
  const top = topOpen(ranked);
  const k = have ? periodScale(period, days) : 0;
  const you = bill; // Victoria has no gas default offer: the bill is the only "you now"
  const saving = you !== null && top ? you - top.total : 0;
  const savingYear = days > 0 ? (saving * 365) / days : 0;
  const verdict: "good" | "bad" | "nobill" = you === null ? "nobill" : savingYear >= WORTH_SWITCHING_PER_YEAR ? "bad" : "good";
  const severe = verdict === "bad" && you !== null && savingYear >= Math.max(250, (you * 365) / days * 0.15);

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

      <GasPlanTable ranked={ranked} days={days} mj={mj} k={k} you={you} youLabel="Your bill" perLabel={PERIOD_LABEL[period]} zone={zone ?? ""} currentRetailer={member.gas_current_retailer ?? null} />
      {(() => {
        const share = heatingShareFor(null, mj / days);
        const months = monthsFromAnnual(annualFromGasBill(mj, days, null, share), share);
        return (
          <GasSeasonChart
            heating={months.heating}
            other={months.other}
            note={`Your last bill's ${Math.round(mj).toLocaleString("en-AU")} MJ over ${days} days, spread across a typical Victorian year. Gas is seasonal: expect winter bills well above this and summer ones well below. Each new bill you snap sharpens the picture.`}
          />
        );
      })()}
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
