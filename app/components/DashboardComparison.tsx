"use client";

import OfferDate from "./OfferDate";
import RatesCompare from "./RatesCompare";
import Icon from "./Icon";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { RETAILER_COUNT, billDetail, rankPlans, topOpen, isEvFriendly, fmtRateCents, fmtRatePerDay, type Distributor, type UsageInput, type PlanRow } from "@/lib/plans";
import { describeOffer } from "@/lib/planExtras";
import OfferTerms, { OfferChips } from "./OfferTerms";
import { planPriceType, PRICE_TYPE_LABEL, PRICE_TYPE_HELP, type PriceType } from "@/lib/planTerms";
import type { CurrentRates } from "@/lib/billExtraction";
import SwitchReminder from "./SwitchReminder";
import type { ResultsChartPalette } from "@/lib/dashThemes";
import { AVERAGE_ANNUAL_KWH, usageOrAverage, vdoBillForUsage } from "@/lib/profileUsage";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { WORTH_SWITCHING_PER_YEAR, OVERPRICED_PER_YEAR, OVERPRICED_SHARE } from "@/lib/dataPolicy";
import { useCountUp } from "@/lib/useCountUp";
import PriceLine from "./PriceLine";
import PlanViewToggle from "./PlanViewToggle";
import { cheapestPerRetailer } from "@/lib/onePerRetailer";
import FunEquivalents from "./FunEquivalents";
import RetailerLogo from "./RetailerLogo";
import type { BillCheckFacts } from "./BillCheckCard";
import { samePlanName } from "@/lib/planVersion";
import { reconcileBill, type BillMismatch } from "@/lib/billReconcile";
import { periodScale } from "@/lib/periods";
import { dailyChanges, marketEvents, type MarketEvent } from "@/lib/marketActivity";
import MarketBoard, { MarketSideCard, type MarketPersonal } from "./MarketBoard";
import MarketRewards, { RewardsSideCard, rewardItems } from "./MarketRewards";
import { useOpenParam } from "@/lib/useOpenParam";
import styles from "./dashcompare.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
export const PERIOD_DAYS = { month: 365 / 12, quarter: 365 / 4, year: 365 } as const;
const PERIOD_LABEL = { month: "a month", quarter: "a quarter", year: "a year" } as const;
export type Period = keyof typeof PERIOD_DAYS;

export interface ComparisonInput {
  distributor: Distributor;
  days: number;
  peak: number;
  shoulder: number;
  offpeak: number;
  anytime: number;
  cl: number;
  solarExportKwh: number;
  /** Max demand in kW, for a home on a demand tariff. */
  demandKw?: number | null;
  /** What they paid for `days` on their last bill, if we know it. */
  billTotal: number | null;
  currentRetailer: string | null;
  currentPlanName: string | null;
  source: "bill" | "answers";
  /** From the bill, when we have it. */
  nmi?: string | null;
  currentRates?: CurrentRates | null;
  /** billTotal is a plan priced by us (the plan they switched to), not a bill: nothing to reconcile. */
  billIsPriced?: boolean;
  currentPriceType?: PriceType | null;
  currentFixedUntil?: string | null;
  /** Charges an EV at home: only then are EV-only plans (free/cheap overnight windows) listed. */
  ev?: boolean;
}

/** Plain-English "how it's charged" for a plan. */
function chargeLabel(plan: PlanRow): string {
  return plan[5] !== null ? "Same price all day" : "Cheaper at night";
}
function chargeHelp(plan: PlanRow): string {
  return plan[5] !== null
    ? "One price for every kWh, whatever the time."
    : "Dearer from late afternoon to evening, cheaper overnight. Suits homes that use more power late at night.";
}

function RetailerLink({ name }: { name: string }) {
  const href = RETAILER_LINKS[name];
  if (!href) return <b>{name}</b>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.retailerLink} title={`Open ${name}'s website`}>
      {name}<span aria-hidden="true"> ↗</span>
    </a>
  );
}

export interface ComparisonSummary {
  verdict: "good" | "bad" | "estimate";
  /** True when the bill is clearly overpriced (shown in red, not clay). */
  severe: boolean;
  haveBill: boolean;
  /** Saving a year by moving to the cheapest plan (0 if none). */
  savingYear: number;
  bestRetailer: string;
  bestPlan: string;
}

/** Shared maths for the verdict, the table and the Savings tab, so every
 *  figure on the dashboard comes from the same calculation. */
export function compute(input: ComparisonInput) {
  // Not enough usage on file (none, under a week, or under 1 kWh a day
  // without solar)? Use the average Victorian home, 4,000 kWh a year.
  const { usage, average } = usageOrAverage({ days: input.days, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, anytime: input.anytime, cl: input.cl, solarExportKwh: input.solarExportKwh, demandKw: input.demandKw ?? null });
  const household = { hasSolar: input.solarExportKwh > 0, currentRetailer: input.currentRetailer ?? null };
  const matches = rankPlans(input.distributor, usage, { ev: input.ev === true, ...household });
  // Cheapest plan this household can get; offers needing a membership and so on stay listed.
  const top = topOpen(matches);
  if (!top || input.days <= 0) return null;
  const offerFor = (p: PlanRow) => describeOffer("E", p[0], p[2], p[1], household);
  const perYear = 365 / input.days;
  // A bill total for usage that thin can't be compared with the average home.
  // Otherwise the bill has to be for the same usage the plans are priced on:
  // if it isn't, compare on their own rates for that usage (or the default
  // offer), never a small bill against plans priced for far more power.
  const rec = average
    ? null
    : input.billIsPriced && input.billTotal !== null && input.billTotal > 0
      ? { you: input.billTotal, basis: "bill" as const, mismatch: null }
      : reconcileBill({ billTotal: input.billTotal, rates: input.currentRates ?? null, usage, distributor: input.distributor });
  const haveBill = !!rec && rec.you !== null;
  const mismatch = rec?.mismatch ?? null;
  const basis = rec?.basis ?? null;
  const vdo = vdoBillForUsage(input.distributor, usage);
  const you = haveBill ? (rec!.you as number) : vdo;
  const savingYear = Math.max(0, (you - top.total) * perYear);
  const cheapest = haveBill && savingYear < WORTH_SWITCHING_PER_YEAR;
  const verdict: ComparisonSummary["verdict"] = haveBill ? (cheapest ? "good" : "bad") : "estimate";
  const severe = verdict === "bad" && (savingYear >= OVERPRICED_PER_YEAR || savingYear >= you * perYear * OVERPRICED_SHARE);
  return { matches, top, haveBill, you, vdo, savingYear, cheapest, verdict, severe, perYear, usage, offerFor, average, mismatch, basis };
}

/** Free users: the two cheapest plans (and anything above the cheapest one
 *  anyone can get) are for members, the same rule as the results page. */
export function lockedTopFor(c: NonNullable<ReturnType<typeof compute>>, member: boolean) {
  return member ? [] : c.matches.slice(0, Math.max(2, c.matches.indexOf(c.top) + 1));
}

/** Facts for the "We checked your bill" card, from the same maths as the verdict. Null without a bill. */
export function billCheckFacts(input: ComparisonInput): BillCheckFacts | null {
  const c = compute(input);
  if (!c || !c.haveBill) return null;
  const retailer = input.currentRetailer ?? "";
  const billPlanName = (input.currentPlanName ?? "").trim();
  const todays =
    retailer && billPlanName
      ? c.matches.find((m) => m.plan[0] === retailer && m.plan[3] === "MARKET" && samePlanName(billPlanName, m.plan[2], retailer)) ?? null
      : null;
  const gap = todays ? c.you - todays.total : 0;
  const older = !!todays && gap * c.perYear >= 20;
  const rb = retailer ? c.matches.find((m) => m.plan[0] === retailer && !m.restricted) ?? null : null;
  return {
    billPlanName,
    olderVersion: older && todays ? { planName: todays.plan[2], perMonth: (gap * (365 / 12)) / input.days, perYear: gap * c.perYear } : null,
    planIsCurrent: !!todays && !older,
    retailerBest: rb ? { planName: rb.plan[2], savingPerYear: (c.you - rb.total) * c.perYear } : null,
    retailerCount: RETAILER_COUNT,
    worthPerYear: WORTH_SWITCHING_PER_YEAR,
  };
}

export function summariseComparison(input: ComparisonInput): ComparisonSummary | null {
  const c = compute(input);
  if (!c) return null;
  return { verdict: c.verdict, severe: c.severe, haveBill: c.haveBill, savingYear: c.savingYear, bestRetailer: c.top.plan[0], bestPlan: c.top.plan[2] };
}

interface Props {
  input: ComparisonInput;
  member: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
}

/** Top of the dashboard: are you on the cheapest plan or not. Always shown
 *  above the tabs. */
export function VerdictCard({ input, member, period, onPeriod }: Props) {
  const c = useMemo(() => compute(input), [input]);
  const k = c ? periodScale(period, input.days) : 0;
  // The headline uses the same scaling as the tiles below it.
  const shown = useCountUp(c ? Math.max(0, (c.you - c.top.total) * k) : 0);
  if (!c) return null;
  const { top, haveBill, you, savingYear, verdict, severe } = c;
  const { distributor, days, currentRetailer, currentPlanName, source } = input;
  const bestTerms = planPriceType(top.plan[0], top.plan[2]);

  return (
    <section className={`${styles.verdict} ${styles[verdict]} ${severe ? styles.severe : ""}`}>
      <div className={styles.verdictTop}>
        <span className={styles.pill}>
          {verdict === "good"
            ? "✓ You're on a good deal"
            : severe
              ? "You're paying far more than you need to"
              : verdict === "bad"
                ? "You could pay less"
                : "Estimate from your answers"}
        </span>
        <div className={styles.toggle} role="tablist" aria-label="Show figures per" style={{ "--i": (Object.keys(PERIOD_DAYS) as Period[]).indexOf(period) } as CSSProperties}>
          <span className={styles.thumb} aria-hidden="true" />
          {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? styles.on : styles.tbtn} onClick={() => onPeriod(p)}>
              {p === "month" ? "Monthly" : p === "quarter" ? "Quarterly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>
      <h2 className={styles.headline}>
        {verdict === "good"
          ? "Nothing beats your plan by enough to bother."
          : verdict === "bad"
            ? <>You could save <span className={styles.amount}>{whole(shown)}</span> {PERIOD_LABEL[period]}</>
            : <>Against the default offer, the cheapest plan saves up to <span className={styles.amount}>{whole(shown)}</span> {PERIOD_LABEL[period]}</>}
      </h2>
      {/* The small print that changes the number: one quiet strip, open on tap. */}
      {(c.mismatch || (haveBill && c.vdo > 0 && (you - c.vdo) / c.vdo >= 0.05)) && (
        <div className={styles.facts}>
          {haveBill && c.vdo > 0 && (you - c.vdo) / c.vdo >= 0.05 && (
            <details className={styles.fact}>
              <summary><Icon name="alert" size={14} /> <b>{Math.round(((you - c.vdo) / c.vdo) * 100)}% above the default offer</b><span className={styles.factMore}>why it matters</span></summary>
              <p>
                The default offer is the government&apos;s reference price: {money(c.vdo * k)} {PERIOD_LABEL[period]} for your usage. Most people can do better than
                the default, so a plan that costs more than it is one worth moving off.
              </p>
            </details>
          )}
          {c.mismatch && <MismatchNote m={c.mismatch} member={member} />}
        </div>
      )}
      <div className={styles.versus}>
        <div className={styles.side} style={{ "--n": 0 } as CSSProperties}>
          <span className={styles.sideLabel}>{haveBill ? "You now" : "Default offer"}</span>
          <b>{haveBill ? currentRetailer ?? "Your current plan" : "VDO"}</b>
          <span className={styles.sidePlan}>{haveBill ? currentPlanName ?? (c.basis === "rates" ? "your rates" : "from your bill") : `${distributor} network`}</span>
          <span key={period} className={styles.sideCost}>{money(you * k)}</span>
          {haveBill && input.currentPriceType === "fixed" && (
            <span className={styles.sideTerms}><Icon name="lock" size={12} /> Fixed price{input.currentFixedUntil ? ` until ${fmtDay(input.currentFixedUntil)}` : ""}</span>
          )}
        </div>
        <div className={styles.arrow} aria-hidden="true">→</div>
        <div className={`${styles.side} ${styles.sideBest}`} style={{ "--n": 1 } as CSSProperties}>
          <span className={styles.sideLabel}>Cheapest we found</span>
          {member ? (
            <>
              <b>{top.plan[0]}</b>
              <span className={styles.sidePlan}>{top.plan[2]}</span>
            </>
          ) : (
            <>
              <b className={styles.sideLocked}><Icon name="lock" size={16} /> Plus members see which</b>
              <span className={styles.sidePlan}>Retailer and plan hidden</span>
            </>
          )}
          <span key={period} className={styles.sideCost}>{money(top.total * k)}</span>
          {member && bestTerms === "fixed" && <span className={styles.sideTerms}><Icon name="lock" size={12} /> Fixed price</span>}
          {member && <span className={styles.sideChips}><OfferChips o={c.offerFor(top.plan)} /></span>}
        </div>
        {verdict !== "good" && savingYear > 0 && (
          <>
            <div className={styles.arrow} aria-hidden="true">=</div>
            <div className={`${styles.side} ${styles.sideSave}`} style={{ "--n": 2 } as CSSProperties}>
              <span className={styles.sideLabel}>You save</span>
              <b>By switching</b>
              <span className={styles.sidePlan}>{PERIOD_LABEL[period]}, to {member ? top.plan[0] : "the cheapest plan"}</span>
              <span key={period} className={styles.sideCost}>{money((you - top.total) * k)}</span>
            </div>
          </>
        )}
      </div>
      {verdict !== "good" && savingYear > 0 && <FunEquivalents dollars={savingYear} />}
      <div className={styles.verdictActions}>
        {!member && (
          <a href="#membership" className={styles.go}><Icon name="lock" size={15} /> See which retailer →</a>
        )}
        {member && verdict !== "good" && RETAILER_LINKS[top.plan[0]] && (
          <a href={RETAILER_LINKS[top.plan[0]]} data-plan={top.plan[2]} data-network={input.distributor} target="_blank" rel="noopener noreferrer" className={styles.go}>Go to {top.plan[0]} →</a>
        )}
        {member && verdict !== "good" && savingYear > 0 && (
          <SwitchReminder retailer={top.plan[0]} plan={top.plan[2]} savingYear={savingYear} link={RETAILER_LINKS[top.plan[0]]} nmi={input.nmi} dark />
        )}
        {!haveBill && <a href={member ? "#savings" : "/check"} className={styles.ghost}>Upload your bill for your real numbers</a>}
      </div>
      <p className={styles.fine}>
        {c.average
          ? `Priced today for the average Victorian home (${AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year), because we don't have enough of your usage yet. Upload a full bill for your own numbers.`
          : input.billIsPriced
            ? `Priced today for the plan you switched to, on the usage from your last bill`
            : `Priced today from ${source === "bill" ? "your last bill" : "your answers"}`}{" "}({days}-day period, shown {PERIOD_LABEL[period]}).
        {member ? " We re-run this every morning and email you only when a move is worth it." : " Estimates only; confirm with the retailer before switching."}
      </p>
    </section>
  );
}

/** The bill total on file is for a different amount of power than the usage on file. */
function MismatchNote({ m, member }: { m: BillMismatch; member: boolean }) {
  const n = (x: number) => Math.round(x).toLocaleString("en-AU");
  return (
    <details className={`${styles.fact} ${styles.factWarn}`}>
      <summary><Icon name="alert" size={14} /> <b>Bill and usage don&apos;t match</b><span className={styles.factMore}>what we did</span></summary>
      <div>
        <p>
          Your bill is {money(m.billTotal)} for {m.days} days
          {m.impliedKwh !== null ? <>, which is about <b>{n(m.impliedKwh)} kWh</b>{m.basis === "rates" ? " at your rates" : " at typical prices"}</> : null}. The usage on file is{" "}
          {n(m.usageKwh)} kWh{m.basis === "rates" ? <>, which your rates make {money(m.usageCost)}</> : null}.{" "}
          {m.basis === "rates"
            ? "So we compare your plan's rates on the same usage as every other plan, not the bill total."
            : "So until they match, we compare against the default offer, not the bill total."}
        </p>
        <p className={styles.mismatchActions}>
          <Link href="/check?start=type">Fix my usage{m.impliedKwh !== null ? ` (${n(m.impliedKwh)} kWh?)` : ""} →</Link>
          {member && <a href="#savings">Or upload the bill</a>}
        </p>
      </div>
    </details>
  );
}

/**
 * The last 30 days on the member's network, each changed offer priced against
 * what they pay now: proof the checking happens, not just market news.
 * Same maths as the verdict above (compute), so the numbers agree.
 */
export function MemberMarket({ input, member, compact = false }: { input: ComparisonInput; member: boolean; compact?: boolean }) {
  const c = useMemo(() => compute(input), [input]);
  // The full market page opens over the dashboard, so members never leave it.
  // false = closed; otherwise the section the page opens at.
  const [open, setOpen] = useState<false | "top" | "rewards">(false);
  const rewards = useMemo(() => (c ? rewardItems(c.matches, c.you, c.perYear) : []), [c]);
  useOpenParam("market", () => setOpen("top"), compact && !!c);
  useOpenParam("rewards", () => setOpen("rewards"), compact && !!c);
  const personal = useMemo<MarketPersonal | null>(() => {
    if (!c) return null;
    const byKey = new Map(c.matches.map((m) => [`${m.plan[0]}|${m.plan[2]}`, m]));
    const against = c.haveBill ? (c.basis === "rates" ? "your plan" : "your bill") : "the default offer";
    const events = marketEvents({ days: 30, network: input.distributor });
    let checked = 0;
    let beat = 0;
    let closest: { retailer: string; diff: number } | null = null;
    for (const e of events) {
      const m = byKey.get(`${e.retailer}|${e.plan}`);
      if (!m) continue;
      checked++;
      if (m.restricted) continue;
      const diff = (m.total - c.you) * c.perYear;
      if (diff <= -WORTH_SWITCHING_PER_YEAR) beat++;
      if (!closest || diff < closest.diff) closest = { retailer: e.retailer, diff };
    }
    // Non-members don't see the cheapest plans by name: don't name the retailer here either.
    const who = (r: string) => (member ? r : "One of them");
    const closestText = !closest
      ? null
      : closest.diff < 0
        ? `Best: ${who(closest.retailer)}, about ${whole(-closest.diff)} a year less than ${against}`
        : `Closest: ${who(closest.retailer)}, about ${whole(closest.diff)} a year more than ${against}`;
    return {
      against,
      network: input.distributor,
      checked,
      beat,
      worthPerYear: WORTH_SWITCHING_PER_YEAR,
      closest: closestText,
      vs: (e) => {
        const m = byKey.get(`${e.retailer}|${e.plan}`);
        if (!m) return { text: "Not one your home can use", tone: "muted" };
        if (m.restricted) return { text: `Limited offer: ${m.restricted}`, tone: "muted" };
        const diff = (m.total - c.you) * c.perYear;
        const vsWhat = c.haveBill ? "you pay" : "the default offer";
        if (Math.abs(diff) < 5) return { text: `About the same as ${vsWhat}`, tone: "muted" };
        return diff < 0 ? { text: `${whole(-diff)} a year less than ${vsWhat}`, tone: "better" } : { text: `${whole(diff)} a year more than ${vsWhat}`, tone: "worse" };
      },
    };
  }, [c, input.distributor, member]);
  if (!c || !personal) return null;
  if (compact) {
    const events = marketEvents({ days: 30, network: input.distributor });
    return (
      <>
        {personal.checked > 0 && <MarketSideCard personal={personal} events={events} onOpen={() => setOpen("top")} />}
        <RewardsSideCard items={rewards} locked={new Set(lockedTopFor(c, member))} onOpen={() => setOpen("rewards")} />
        {open && <MarketDetail c={c} input={input} member={member} personal={personal} events={events} startAt={open} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (personal.checked === 0) return null;
  return <MarketBoard personal={personal} />;
}

/** The Compare tab: chart plus every comparable plan, ranked. Table on wide
 *  screens, one card per retailer on phones. */
export function CompareSection({ input, member, period }: Omit<Props, "onPeriod"> & { chartPalette?: ResultsChartPalette }) {
  const [showAll, setShowAll] = useState(false);
  // Which plan's rates are open (retailer + plan), on the table or the phone cards.
  const [openRates, setOpenRates] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState(false);
  const c = useMemo(() => compute(input), [input]);
  if (!c) return null;
  const { matches: allMatches, top, haveBill, you, vdo, offerFor } = c;
  // One row per retailer (its cheapest plan) unless they ask for every plan.
  const perRetailer = cheapestPerRetailer(allMatches, top);
  const matches = allPlans ? allMatches : perRetailer;
  const { distributor, days, currentRetailer, currentPlanName, source } = input;
  const k = periodScale(period, days);
  // Each plan against the Victorian Default Offer for the same usage, as a percentage.
  const vsVdo = (total: number) => (vdo > 0 ? (total - vdo) / vdo : 0);
  const pct = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`; };
  const vdoWords = (x: number) => { const n = Math.round(x * 100); return n < 0 ? `${-n}% below default offer` : n > 0 ? `${n}% above default offer` : "Same as default offer"; };
  const u = c.usage;
  const kwhPeriod = (u.peak + u.shoulder + u.offpeak + u.anytime + u.cl) * k;
  const kwhDay = days > 0 ? (u.peak + u.shoulder + u.offpeak + u.anytime + u.cl) / days : 0;
  // How they're charged, in plain words. Only from a bill (or their rates):
  // an estimate from answers doesn't know their tariff.
  const fromBillOrRates = source === "bill" || !!input.currentRates;
  const tariffWords = !fromBillOrRates
    ? ""
    : (input.currentRates
        ? input.currentRates.anytime !== null ? "charged at one price all day" : input.currentRates.peak !== null ? "charged by time of day" : ""
        : input.peak + input.shoulder + input.offpeak > 0 ? "charged by time of day" : "charged at one price all day") +
      (input.cl > 0 ? ", plus a separate hot-water meter" : "");
  const retailerBest = currentRetailer ? allMatches.find((m) => m.plan[0] === currentRetailer && !m.restricted) ?? null : null;
  const topOffer = offerFor(top.plan);
  const topDetail = billDetail(top.plan, c.usage);
  const lockedTop = lockedTopFor(c, member);
  const isLocked = (m: (typeof matches)[number] | null) => !!m && lockedTop.includes(m);
  const rows = showAll ? matches : matches.slice(0, 10);

  return (
    <>
      {retailerBest && retailerBest !== top && isLocked(retailerBest) && (
        <div className={styles.stay}>
          <b>Staying with {currentRetailer}?</b> One of the {lockedTop.length} cheapest plans is theirs, at {money(retailerBest.total * k)} {PERIOD_LABEL[period]}.
          Plus members see which one, so you can ask {currentRetailer} to move you without changing company.
        </div>
      )}
      {retailerBest && retailerBest !== top && !isLocked(retailerBest) && (
        <div className={styles.stay}>
          <b>Staying with {currentRetailer}?</b> Their cheapest current plan for you is &ldquo;{retailerBest.plan[2]}&rdquo; at {money(retailerBest.total * k)} {PERIOD_LABEL[period]},{" "}
          <span className={styles.stayGap}>{whole((retailerBest.total - top.total) * k)} more</span> than {member ? top.plan[0] : "the cheapest plan"}.
          {!haveBill && <> You may be on an older, dearer {currentRetailer} plan: upload your bill to see what you actually pay.</>}
        </div>
      )}

      <section className={styles.table}>
        <div className={styles.tableHead}>
          <h3>Retailer comparison</h3>
          <p>
            {allPlans
              ? `All ${allMatches.length} plans from the retailers we track on the ${distributor} network`
              : `Each retailer's cheapest plan for you on the ${distributor} network`}{" "}
            (not every plan in the market), cheapest first, {PERIOD_LABEL[period]}. Tap a retailer to visit their website.
          </p>
          <PlanViewToggle all={allPlans} onChange={(v) => { setAllPlans(v); setShowAll(false); }} retailers={perRetailer.length} plans={allMatches.length} />
        </div>
        <div className={styles.chart}>
          <PriceLine
            items={matches.slice(0, 8).map((m) => ({ retailer: m.plan[0], plan: m.plan[2], value: m.total * k, locked: isLocked(m), cheapest: m === top }))}
            you={you * k}
            youLabel={haveBill ? (c.basis === "rates" ? "Your plan" : "Your bill") : "The default offer"}
            vdo={haveBill ? vdo * k : null}
            per={PERIOD_LABEL[period]}
          />
        </div>

        {/* What we're comparing against, right before the results */}
        <div className={styles.youBox}>
          <div className={styles.youMain}>
            <span className={styles.youLabel}>{haveBill ? (c.basis === "rates" ? "Your current plan" : "Your current bill") : "The default offer (VDO)"}</span>
            <b className={styles.youCost}>{money(you * k)} <small>{PERIOD_LABEL[period]}</small></b>
          </div>
          <p className={styles.youText}>
            {haveBill ? (
              <>
                Based on {source === "bill" ? "your last bill" : "your answers"}: about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}</b> ({kwhDay.toFixed(1)} kWh a day){tariffWords ? `, ${tariffWords}` : ""}
                {currentRetailer ? <> with {currentRetailer}{currentPlanName ? <>, &ldquo;{currentPlanName}&rdquo;</> : null}</> : null}.{" "}
                {Math.abs(vsVdo(you)) < 0.02 ? (
                  <>That&apos;s about the same as the default offer ({money(vdo * k)} {PERIOD_LABEL[period]}), the government&apos;s reference price for the same usage.</>
                ) : vsVdo(you) > 0 ? (
                  <>That&apos;s <b className={styles.neg}>{pct(vsVdo(you)).replace(/^\+/, "")} more</b> than the default offer ({money(vdo * k)} {PERIOD_LABEL[period]}), the government&apos;s reference price for the same usage.</>
                ) : you - top.total > 0.005 ? (
                  <>You&apos;re under the default offer, but {member ? top.plan[0] : "the cheapest plan"} would still cost <b className={styles.pos}>{money((you - top.total) * k)} {PERIOD_LABEL[period]} less</b>.</>
                ) : (
                  <>You&apos;re under the default offer and nothing we found is cheaper.</>
                )}
              </>
            ) : c.average ? (
              <>
                We don&apos;t have enough of your usage yet, so this is the average Victorian home: <b>{AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year</b>{" "}
                (about {Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}), priced on the default offer. Upload a full bill for your own numbers.
              </>
            ) : (
              <>
                The Victorian Default Offer priced at about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}</b> ({kwhDay.toFixed(1)} kWh a day){tariffWords ? `, ${tariffWords}` : ""}. Add your bill to compare against what you really pay.
              </>
            )}
          </p>
        </div>

        {/* Wide screens: the full table */}
        <div className={styles.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th>How it&apos;s charged</th><th className={styles.num}>Cost {PERIOD_LABEL[period]}</th><th className={styles.num}>vs {haveBill ? "your bill" : "default offer"}</th><th className={styles.num} title="Each plan against the Victorian Default Offer for the same usage">vs default offer</th></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const diff = (you - m.total) * k;
                const mine = currentRetailer && m.plan[0] === currentRetailer;
                if (isLocked(m)) {
                  return (
                    <tr key={`locked-${i}`} className={styles.rowLocked}>
                      <td>{i + 1}</td>
                      <td colSpan={3}>
                        <span className={styles.lockedCell}>
                          <span className={styles.lockBadge}><Icon name="lock" size={14} /></span>
                          <span className={styles.lockedBar} aria-hidden="true" />
                          <a href="#membership">{i === 0 ? "The cheapest plan: members see which" : "Plus members see this plan"}</a>
                        </span>
                      </td>
                      <td className={styles.num}>{money(m.total * k)}</td>
                      <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                      <td className={`${styles.num} ${Math.round(vsVdo(m.total) * 100) < 0 ? styles.pos : Math.round(vsVdo(m.total) * 100) > 0 ? styles.neg : styles.flat}`}>{pct(vsVdo(m.total))}</td>
                    </tr>
                  );
                }
                const key = `${m.plan[0]}|${m.plan[2]}`;
                return (
                  <Fragment key={key + i}>
                  <tr className={m === top ? styles.rowBest : mine ? styles.rowMine : ""} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <td>{i + 1}</td>
                    <td>
                      <span className={styles.retailerCell}>
                        <RetailerLogo name={m.plan[0]} size={28} />
                        <RetailerLink name={m.plan[0]} />
                      </span>
                      {m === top && <span className={styles.tagBest}>{i === 0 ? "Cheapest" : "Cheapest you can get"}</span>}
                      {mine && <span className={styles.tagMine}>Your retailer</span>}
                      {input.ev && isEvFriendly(m.plan) && <span className={styles.tagEv}><Icon name="bolt" size={12} /> EV charging</span>}
                    </td>
                    <td className={styles.planName}>{m.plan[2]}<br /><OfferDate retailer={m.plan[0]} plan={m.plan[2]} /><span className={styles.offerChips}><OfferChips o={offerFor(m.plan)} /></span></td>
                    <td title={chargeHelp(m.plan)}>
                      {chargeLabel(m.plan)}
                      {planPriceType(m.plan[0], m.plan[2]) === "fixed" && <span className={styles.ptFixed}> · <Icon name="lock" size={12} /> Fixed</span>}
                      <br />
                      <button type="button" className={styles.ratesToggle} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                        {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                      </button>
                    </td>
                    <td className={styles.num}>{money(m.total * k)}</td>
                    <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                    <td className={`${styles.num} ${Math.round(vsVdo(m.total) * 100) < 0 ? styles.pos : Math.round(vsVdo(m.total) * 100) > 0 ? styles.neg : styles.flat}`}>{pct(vsVdo(m.total))}</td>
                  </tr>
                  {openRates === key && (
                    <tr key={`${key}-rates`} className={styles.ratesDetailRow}>
                      <td colSpan={7}>
                        <div className={styles.ratesDetail}>
                          <RatesCompare current={input.currentRates ?? null} plan={m.plan} planLabel={m.plan[0]} compact />
                          <p className={styles.ratesFine}>Including GST, before discounts.{input.currentRates ? " ✓ marks the better rate." : ""}</p>
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

        {/* Phones: one card per plan */}
        <ol className={styles.cards}>
          {rows.map((m, i) => {
            const diff = (you - m.total) * k;
            const mine = currentRetailer && m.plan[0] === currentRetailer;
            if (isLocked(m)) {
              return (
                <li key={`locked-${i}`} className={`${styles.pc} ${styles.rowLocked}`}>
                  <span className={styles.pcRank}>{i + 1}</span>
                  <div className={styles.pcMain}>
                    <div className={styles.pcTop}>
                      <span className={styles.lockBadge}><Icon name="lock" size={14} /></span>
                      <span className={styles.lockedBar} aria-hidden="true" />
                    </div>
                    <a className={styles.pcPlan} href="#membership">Plus members see this plan</a>
                  </div>
                  <div className={styles.pcNums}>
                    <b>{whole(m.total * k)}</b>
                    <span className={diff >= 0 ? styles.pos : styles.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>
                  </div>
                </li>
              );
            }
            const key = `${m.plan[0]}|${m.plan[2]}`;
            return (
              <li key={key + i} className={`${styles.pc} ${m === top ? styles.rowBest : mine ? styles.rowMine : ""}`}>
                <span className={styles.pcRank}>{i + 1}</span>
                <div className={styles.pcMain}>
                  <div className={styles.pcTop}>
                    <RetailerLogo name={m.plan[0]} size={26} />
                    <RetailerLink name={m.plan[0]} />
                    {m === top && <span className={styles.tagBest}>{i === 0 ? "Cheapest" : "Best you can get"}</span>}
                    {mine && <span className={styles.tagMine}>Yours</span>}
                  </div>
                  <span className={styles.pcPlan}>{m.plan[2]} · {chargeLabel(m.plan)}{planPriceType(m.plan[0], m.plan[2]) === "fixed" ? " · Fixed price" : ""}</span>
                  <OfferDate retailer={m.plan[0]} plan={m.plan[2]} />
                  <span className={styles.offerChips}><OfferChips o={offerFor(m.plan)} /></span>
                </div>
                <div className={styles.pcNums}>
                  <b>{whole(m.total * k)}</b>
                  <span className={diff >= 0 ? styles.pos : styles.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>
                  <span className={styles.pcVdo}>{vdoWords(vsVdo(m.total))}</span>
                </div>
                <button type="button" className={`${styles.ratesToggle} ${styles.pcRates}`} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                  {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                </button>
                {openRates === key && (
                  <div className={`${styles.ratesDetail} ${styles.pcRatesDetail}`}>
                    <RatesCompare current={input.currentRates ?? null} plan={m.plan} planLabel={m.plan[0]} compact />
                    <p className={styles.ratesFine}>Including GST, before discounts.{input.currentRates ? " ✓ marks the better rate." : ""}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {matches.length > 10 && (
          <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show the top 10" : allPlans ? `Show all ${matches.length} plans` : `Show all ${matches.length} retailers`}
          </button>
        )}
        <div className={styles.legend}>
          <span><b>Default offer</b>: the Victorian Default Offer, the government-set reference price. Each plan is compared with it for the same usage; minus (or &ldquo;below&rdquo;) is cheaper.</span>
          <span><b>Labels</b>: ✓ green discounts are in the price (we assume you pay on time); blue ones (credits, other conditions) aren&apos;t; amber ! means who can get it is limited, or a fee to know about. Concessions aren&apos;t counted.</span>
          <span><b>Same price all day</b>: one rate for every kWh.</span>
          <span><b>Cheaper at night</b>: dearer late afternoon to evening, cheaper overnight.</span>
          <span><b><Icon name="lock" size={12} /> Fixed</b>: price locked for a set time. Everything else can change with notice, usually around 1 July.</span>
          {!input.ev && <span>Plans built around EV charging are hidden. Tell us you charge an EV to include them.</span>}
        </div>
        {!member && (
          <p className={styles.upsell}>
            Plus members get this table re-run every morning, a bill read every month, and an email the day something cheaper appears.{" "}
            <Link href="#membership">See plans</Link>
          </p>
        )}
      </section>

      {!member ? (
        <section className={styles.table}>
          <div className={styles.tableHead}>
            <h3>Before you switch</h3>
            <p>Plus members see the cheapest plan&apos;s retailer, discounts, sign-up conditions, credits and fees here, from the retailer&apos;s own price feed.</p>
          </div>
          <a href="#membership" className={styles.go}><Icon name="lock" size={15} /> Unlock the cheapest plans →</a>
        </section>
      ) : (
      <section className={styles.table}>
        <div className={styles.tableHead}>
          <h3>Before you switch to {top.plan[0]}</h3>
          <p>Discounts, what you need to sign up, credits and fees for &ldquo;{top.plan[2]}&rdquo;, from {top.plan[0]}&apos;s own price feed.</p>
        </div>
        <OfferTerms
          o={topOffer}
          retailer={top.plan[0]}
          title={null}
          payLateCost={topDetail && topDetail.conditionalDiscount * k >= 0.5 ? `${money(topDetail.conditionalDiscount * k)} ${PERIOD_LABEL[period]}` : null}
        />
      </section>
      )}

      <CurrentPricing input={input} usage={c.usage} best={top.plan} bestTotal={top.total} you={you} haveBill={haveBill} hideName={!member} />
    </>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}


/** Your current plan's rates (read off your bill) beside the cheapest plan's,
 *  plus fixed or variable, and the all-in average cents per kWh. */
function CurrentPricing({ input, usage, best, bestTotal, you, haveBill, hideName = false }: { input: ComparisonInput; usage: UsageInput; best: PlanRow; bestTotal: number; you: number; haveBill: boolean; hideName?: boolean }) {
  const r = input.currentRates ?? null;
  const [, , , , bSupply, bAny, bPeak, bShoulder, bOff, bCl, bFit] = best;
  const kwh = usage.peak + usage.shoulder + usage.offpeak + usage.anytime + usage.cl;
  const bestTerms = planPriceType(best[0], best[2]);
  const touBest = bAny === null;
  const touYou = r ? r.anytime === null && (r.peak !== null || r.offpeak !== null) : touBest;

  type Row = { label: string; you: number | null; best: number | null; perDay?: boolean; lowerIsBetter?: boolean };
  const rows: Row[] = [{ label: "Daily supply", you: r?.supply ?? null, best: bSupply, perDay: true }];
  if (!touYou || !touBest) rows.push({ label: "Usage (flat rate)", you: r?.anytime ?? null, best: bAny });
  if (touYou || touBest) {
    rows.push({ label: "Peak", you: r?.peak ?? null, best: bPeak });
    // Two-rate plans charge shoulder hours at the off-peak rate.
    const bestShoulder = bShoulder ?? (bPeak !== null ? bOff : null);
    if ((r?.shoulder ?? null) !== null || bShoulder !== null) rows.push({ label: "Shoulder", you: r?.shoulder ?? null, best: bestShoulder });
    rows.push({ label: "Off-peak", you: r?.offpeak ?? null, best: bOff });
  }
  if (input.cl > 0 || (r?.cl ?? null) !== null) rows.push({ label: "Controlled load", you: r?.cl ?? null, best: bCl });
  if (input.solarExportKwh > 0 || (r?.solarFit ?? null) !== null) rows.push({ label: "Solar feed-in", you: r?.solarFit ?? null, best: bFit ?? null, lowerIsBetter: false });

  // A zero usage rate is a free window; a zero feed-in is just nothing paid.
  const fmt = (v: number | null, perDay?: boolean, paidToYou?: boolean) =>
    v === null ? "–" : perDay ? fmtRatePerDay(v) : v === 0 ? (paidToYou ? "0c/kWh" : "Free (set hours)") : fmtRateCents(v);
  const avgYou = haveBill && kwh > 0 ? you / kwh : null;
  const avgBest = kwh > 0 ? bestTotal / kwh : null;
  const youTerms = input.currentPriceType ?? null;

  return (
    <section className={styles.table}>
      <div className={styles.tableHead}>
        <h3>Your rates vs the cheapest</h3>
        <p>What you pay per day and per kWh now, beside {hideName ? "the cheapest plan" : best[0]}. All prices include GST.</p>
      </div>
      <div className={styles.rates}>
        <div className={styles.ratesHead}>
          <span />
          <div>
            <b>You now</b>
            <span>{input.currentRetailer ?? "Your retailer"}{input.currentPlanName ? ` · ${input.currentPlanName}` : ""}</span>
            <em className={youTerms === "fixed" ? styles.badgeFixed : styles.badge}>
              {youTerms ? `${PRICE_TYPE_LABEL[youTerms]}${input.currentFixedUntil ? ` until ${fmtDay(input.currentFixedUntil)}` : ""}` : "Fixed or variable: not on file"}
            </em>
          </div>
          <div>
            <b>Cheapest</b>
            <span>{hideName ? "Plus members see which retailer" : `${best[0]} · ${best[2]}`}</span>
            <em className={bestTerms === "fixed" ? styles.badgeFixed : styles.badge}>{PRICE_TYPE_LABEL[bestTerms]}</em>
          </div>
        </div>
        {rows.map((row) => {
          const better = row.lowerIsBetter === false ? (a: number, b: number) => a > b : (a: number, b: number) => a < b;
          const youWorse = row.you !== null && row.best !== null && better(row.best, row.you);
          return (
            <div className={styles.ratesRow} key={row.label}>
              <span className={styles.ratesLabel}>{row.label}</span>
              <span className={youWorse ? styles.neg : ""}>{fmt(row.you, row.perDay, row.lowerIsBetter === false)}</span>
              <span>{fmt(row.best, row.perDay, row.lowerIsBetter === false)}</span>
            </div>
          );
        })}
        <div className={`${styles.ratesRow} ${styles.ratesAvg}`}>
          <span className={styles.ratesLabel}>All-in average<small>bill ÷ kWh used</small></span>
          <span className={avgYou !== null && avgBest !== null && avgYou > avgBest ? styles.neg : ""}>{avgYou !== null ? fmtRateCents(avgYou) : "–"}</span>
          <span className={styles.pos}>{avgBest !== null ? fmtRateCents(avgBest) : "–"}</span>
        </div>
      </div>
      {!r && (
        <p className={styles.fineDark}>
          Your own rates come off your bill. {haveBill ? "Upload your next bill and we'll fill these in." : "Upload a bill to see them here."}
        </p>
      )}
      <p className={styles.fineDark}>{youTerms ? PRICE_TYPE_HELP[youTerms] : PRICE_TYPE_HELP.variable}</p>
    </section>
  );
}

/**
 * The member's market, in full (opened from the dashboard's "last 30 days"
 * card): what changed, a chart of the month, every retailer's cheapest plan
 * priced for their home against what they pay, and every change, newest first.
 */
function MarketDetail({ c, input, member, personal, events, onClose, startAt = "top" }: {
  c: NonNullable<ReturnType<typeof compute>>;
  input: ComparisonInput;
  member: boolean;
  personal: MarketPersonal;
  events: MarketEvent[];
  onClose: () => void;
  startAt?: "top" | "rewards";
}) {
  // Opened from the rewards card: glide down to that section.
  useEffect(() => {
    if (startAt !== "rewards") return;
    const t = window.setTimeout(() => {
      const el = document.getElementById("md-rewards");
      const box = el?.closest("[role=dialog]") as HTMLElement | null;
      if (!el || !box) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 76, behavior: reduce ? "auto" : "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [startAt]);
  // Esc closes; the page behind doesn't scroll while this is open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  const [allRet, setAllRet] = useState(false);
  const [allFeed, setAllFeed] = useState(false);
  const locked = new Set(lockedTopFor(c, member));
  const perRet = cheapestPerRetailer(c.matches.filter((m) => !m.restricted), c.top);
  const yearly = (t: number) => t * c.perYear;
  const youYear = yearly(c.you);
  const max = Math.max(youYear, ...perRet.map((m) => yearly(m.total)), 1);
  const changesBy = new Map<string, { n: number; last: string }>();
  for (const e of events) {
    const x = changesBy.get(e.retailer);
    if (!x) changesBy.set(e.retailer, { n: 1, last: e.date });
    else { x.n++; if (e.date > x.last) x.last = e.date; }
  }
  const days = dailyChanges(events, 30);
  const dayMax = Math.max(...days.map((d) => d.newOffers + d.priceChanges), 1);
  const newOffers = events.filter((e) => e.kind === "new").length;
  const cheaper = perRet.filter((m) => (c.you - m.total) * c.perYear >= 1).length;
  const best = perRet[0];
  const bestSave = best ? Math.max(0, (c.you - best.total) * c.perYear) : 0;
  const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  const against = c.haveBill ? "your bill" : "the default offer";
  // Top 5 retailers and the 10 latest changes; the rest fold out.
  const RET_SHOWN = 5;
  const FEED_SHOWN = 10;
  const retShown = allRet ? perRet : perRet.slice(0, RET_SHOWN);
  const feedShown = allFeed ? events : events.slice(0, FEED_SHOWN);
  return createPortal(
    <div className={styles.mdOverlay} role="dialog" aria-modal="true" aria-labelledby="md-title">
      <div className={styles.mdBar}>
        <button type="button" className={styles.mdBack} onClick={onClose}>← Back to my dashboard</button>
        <span className={styles.mdNet}>{input.distributor} network · last 30 days</span>
      </div>
      <div className={styles.mdBody}>
        <h2 id="md-title" className={styles.mdTitle}>Your market this month</h2>
        <p className={styles.mdLede}>Every offer that changed on your network, priced for your home against {against}.</p>

        <div className={styles.mdTiles}>
          <div className={styles.mdTile}><b>{personal.checked}</b><span>changed offers checked for you</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileGood}`}><b>{personal.beat}</b><span>beat {against} by ${WORTH_SWITCHING_PER_YEAR}+ a year</span></div>
          <div className={styles.mdTile}><b>{cheaper}</b><span>of {perRet.length} retailers are cheaper than {against}</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileSave}`}><b>{whole(bestSave)}</b><span>a year: the most you could save{member && best ? `, with ${best.plan[0]}` : ""}</span></div>
        </div>

        <section className={styles.mdCard} aria-labelledby="md-chart">
          <h3 id="md-chart">Changes by day</h3>
          <p className={styles.mdSub}>{newOffers} new offers and {events.length - newOffers} updated offers in 30 days.</p>
          <div className={styles.mdChart} role="img" aria-label={`${events.length} changes over 30 days`}>
            {days.map((d) => {
              const t = d.newOffers + d.priceChanges;
              return (
                <span key={d.date} className={styles.mdCol} title={`${shortDay(d.date)}: ${d.newOffers} new, ${d.priceChanges} updated`}>
                  <i className={styles.mdPrice} style={{ height: `${(d.priceChanges / dayMax) * 100}%` }} />
                  <i className={styles.mdNew} style={{ height: `${(d.newOffers / dayMax) * 100}%` }} />
                  {t === 0 && <i className={styles.mdZero} />}
                </span>
              );
            })}
          </div>
          <div className={styles.mdAxis}><span>{shortDay(days[0].date)}</span><span>Today</span></div>
          <div className={styles.mdLegend}><span><i className={styles.mdNew} /> New offer</span><span><i className={styles.mdPrice} /> Updated offer</span></div>
        </section>

        <section className={styles.mdCard} aria-labelledby="md-ret">
          <h3 id="md-ret">Cheapest retailers for your home</h3>
          <p className={styles.mdSub}>Each retailer&apos;s cheapest plan you can get, a year. The line is {against}: {whole(youYear)}.</p>
          <ol className={styles.mdRank}>
            {retShown.map((m, i) => {
              const diff = (c.you - m.total) * c.perYear;
              const hide = locked.has(m);
              const ch = changesBy.get(m.plan[0]);
              return (
                <li key={`${m.plan[0]}|${m.plan[2]}`} className={styles.mdRow}>
                  <span className={styles.mdRankNo}>{i + 1}</span>
                  {hide ? <span className={styles.mdLock}><Icon name="lock" size={16} /></span> : <RetailerLogo name={m.plan[0]} size={34} square />}
                  <span className={styles.mdWho}>
                    <b>{hide ? "Plus members see this retailer" : m.plan[0]}</b>
                    <small>{hide ? "Retailer and plan hidden" : m.plan[2]}</small>
                    {ch && !hide && <em className={styles.mdChg}>{ch.n} change{ch.n === 1 ? "" : "s"} · latest {shortDay(ch.last)}</em>}
                  </span>
                  <span className={styles.mdBarWrap}>
                    <span className={styles.mdTrack}>
                      <span className={diff >= 0 ? styles.mdBarGood : styles.mdBarBad} style={{ width: `${(yearly(m.total) / max) * 100}%` }} />
                      <span className={styles.mdYou} style={{ left: `${(youYear / max) * 100}%` }} aria-hidden="true" />
                    </span>
                  </span>
                  <span className={styles.mdNums}>
                    <b>{whole(yearly(m.total))}</b>
                    <small className={diff >= 0 ? styles.pos : styles.neg}>{Math.abs(diff) < 1 ? "Same" : diff > 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</small>
                  </span>
                </li>
              );
            })}
          </ol>
          {perRet.length > RET_SHOWN && (
            <button type="button" className={styles.mdMore} aria-expanded={allRet} onClick={() => setAllRet((v) => !v)}>
              {allRet ? "Show the top 5" : `Show all ${perRet.length} retailers`}
            </button>
          )}
        </section>

        <MarketRewards matches={c.matches} you={c.you} perYear={c.perYear} against={against} locked={locked as Set<unknown>} whole={whole} />

        <section className={styles.mdCard} aria-labelledby="md-feed">
          <h3 id="md-feed">Latest changes on your network</h3>
          <p className={styles.mdSub}>
            New offers, and offers a retailer has republished with new rates, discounts or terms for new customers. Each one priced for your home.
          </p>
          <ul className={styles.mdFeed}>
            {feedShown.map((e, i) => {
              const v = personal.vs(e);
              return (
                <li key={`${e.retailer}|${e.plan}|${i}`}>
                  <span className={styles.mdDate}>{shortDay(e.date)}</span>
                  <RetailerLogo name={e.retailer} size={28} square />
                  <span className={styles.mdWho}>
                    <b>{e.retailer}</b>
                    <small title={e.plan}>{e.plan}</small>
                  </span>
                  <span className={e.kind === "new" ? styles.mdTagNew : styles.mdTagPrice}>{e.kind === "new" ? "New offer" : "Updated offer"}</span>
                  {v && <span className={v.tone === "better" ? styles.mdVsGood : v.tone === "worse" ? styles.mdVsBad : styles.mdVsMuted}>{v.text}</span>}
                </li>
              );
            })}
          </ul>
          {events.length > FEED_SHOWN && (
            <button type="button" className={styles.mdMore} aria-expanded={allFeed} onClick={() => setAllFeed((v) => !v)}>
              {allFeed ? "Show the latest 10" : `Show all ${events.length} changes`}
            </button>
          )}
        </section>
        <button type="button" className={styles.mdBackBottom} onClick={onClose}>← Back to my dashboard</button>
      </div>
    </div>,
    document.body,
  );
}
