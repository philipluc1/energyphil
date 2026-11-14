"use client";

import OfferDate from "./OfferDate";
import RatesCompare from "./RatesCompare";
import Icon from "./Icon";
import PriceAddsUp from "./PriceAddsUp";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { FREE_SHOWS_NAMES, WORTH_SWITCHING_PER_YEAR, OVERPRICED_PER_YEAR, OVERPRICED_SHARE } from "@/lib/dataPolicy";
import { stickyPick } from "@/lib/stickyPick";
import { useCountUp } from "@/lib/useCountUp";
import PlanViewToggle from "./PlanViewToggle";
import { cheapestPerRetailer } from "@/lib/onePerRetailer";
import RankedBars from "./RankedBars";
import PlanOptions, { type PlanOption } from "./PlanOptions";
import RetailerLogo from "./RetailerLogo";
import ComplaintBadge from "./ComplaintBadge";
import DayChanges from "./DayChanges";
import type { BillCheckFacts } from "./BillCheckCard";
import { PLAN_VS_BILL_TAG, planVsBill, samePlanName } from "@/lib/planVersion";
import { reconcileBill, type BillMismatch } from "@/lib/billReconcile";
import { showLabel, showPeriod, showScale, type ShowPeriod } from "@/lib/periods";
import { rateRows } from "@/lib/rateRows";
import { standardVsVdo } from "@/lib/vdoCompare";
import { sameRetailer } from "@/lib/sameRetailer";
import { marketEvents, type MarketEvent } from "@/lib/marketActivity";
import MarketBoard, { MarketSideCard, type MarketPersonal } from "./MarketBoard";
import MarketRewards, { RewardsSideCard, rewardItems } from "./MarketRewards";
import { useOpenParam } from "@/lib/useOpenParam";
import { WHATIF_EV_KWH_PER_DAY, adjustUsage, currentPricer, seasonFactors } from "@/lib/homeInsights";
import type { HomeProfile } from "@/lib/profileUsage";
import ins from "./insights.module.css";
import styles from "./dashcompare.module.css";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
export const PERIOD_DAYS = { month: 365 / 12, quarter: 365 / 4, year: 365 } as const;
/** What the figures are shown for: the bill's own period ("bill"), a month, a quarter or a year. */
export type Period = ShowPeriod;

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
  /** 2 Nov 2026: the member's pick (the plan we last recommended). Kept until another plan
   *  beats it by the switching threshold, so every screen and email names the same plan. */
  pick?: { retailer: string | null; plan: string | null } | null;
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
  /** The best plan is with the retailer they're already with. */
  sameRetailer?: boolean;
  /** …and the same plan name as their bill: they're on older rates. */
  samePlanName?: boolean;
}

/** Shared maths for the verdict, the table and the Savings tab, so every
 *  figure on the dashboard comes from the same calculation. */
export function compute(input: ComparisonInput) {
  // Not enough usage on file (none, under a week, or under 1 kWh a day
  // without solar)? Use the average Victorian home, 4,000 kWh a year.
  const { usage, average } = usageOrAverage({ days: input.days, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, anytime: input.anytime, cl: input.cl, solarExportKwh: input.solarExportKwh, demandKw: input.demandKw ?? null });
  const household = { hasSolar: input.solarExportKwh > 0, currentRetailer: input.currentRetailer ?? null };
  const matches = rankPlans(input.distributor, usage, { ev: input.ev === true, ...household });
  // Our pick: the member's stored pick while it's within the switching threshold of
  // the cheapest, else the cheapest this household can get (lib/stickyPick.ts).
  const sp = input.days > 0 ? stickyPick(matches, input.pick ?? null, input.days) : null;
  const top = sp?.pick ?? topOpen(matches);
  if (!top || input.days <= 0) return null;
  const cheapestPlan = sp?.cheapest ?? top;
  const nearTies = sp?.nearTies ?? [];
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
  return { matches, top, cheapestPlan, nearTies, haveBill, you, vdo, savingYear, cheapest, verdict, severe, perYear, usage, offerFor, average, mismatch, basis };
}

/** Free users: the two cheapest plans (and anything above the cheapest one
 *  anyone can get) are for members, the same rule as the results page. */
export function lockedTopFor(c: NonNullable<ReturnType<typeof compute>>, member: boolean) {
  return member || FREE_SHOWS_NAMES ? [] : c.matches.slice(0, Math.max(2, c.matches.indexOf(c.top) + 1));
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
    retailerBest: rb ? { planName: rb.plan[2], savingPerYear: (c.you - rb.total) * c.perYear, tariff: rb.plan[5] !== null ? "flat" : rb.plan[6] !== null ? "tou" : null } : null,
    retailerCount: RETAILER_COUNT,
    worthPerYear: WORTH_SWITCHING_PER_YEAR,
    // Only a real bill's rates can be checked (not a plan we priced after a switch).
    money: input.billIsPriced
      ? null
      : { rates: input.currentRates ?? null, days: input.days, anytime: input.anytime, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, cl: input.cl, solarExportKwh: input.solarExportKwh, distributor: input.distributor },
  };
}

export function summariseComparison(input: ComparisonInput): ComparisonSummary | null {
  const c = compute(input);
  if (!c) return null;
  return { verdict: c.verdict, severe: c.severe, haveBill: c.haveBill, savingYear: c.savingYear, bestRetailer: c.top.plan[0], bestPlan: c.top.plan[2], sameRetailer: c.haveBill && sameRetailer(input.currentRetailer, c.top.plan[0]),
    samePlanName: c.haveBill && sameRetailer(input.currentRetailer, c.top.plan[0]) && !!input.currentPlanName && samePlanName(input.currentPlanName, c.top.plan[2], c.top.plan[0]) };
}

interface Props {
  input: ComparisonInput;
  member: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
}

/** Top of the dashboard: are you on the cheapest plan or not. Always shown
 *  above the tabs. */
export function VerdictCard({ input, member }: Props) {
  // Everyone sees names (FREE_SHOWS_NAMES); the watching is what Plus adds.
  const names = member || FREE_SHOWS_NAMES;
  const c = useMemo(() => compute(input), [input]);
  // 14 Nov 2026 (Phil): one message, one action. Always a year (no period tabs here).
  const shown = useCountUp(c ? Math.max(0, c.savingYear) : 0);
  if (!c) return null;
  const { top, haveBill, you, savingYear, verdict, severe, perYear } = c;
  const { days, currentRetailer, source } = input;
  // The cheapest plan is with the retailer they already pay (2 Nov 2026).
  const samePlace = names && haveBill && sameRetailer(currentRetailer, top.plan[0]);
  const link = RETAILER_LINKS[top.plan[0]];
  return (
    <section className={`${styles.verdict} ${styles[verdict]} ${severe ? styles.severe : ""}`}>
      <div className={styles.verdictTop}>
        <span className={styles.pill}>
          {verdict === "good" ? "✓ You're on a good deal" : verdict === "bad" ? "You could pay less" : "Estimate"}
        </span>
      </div>
      <h2 className={styles.headline}>
        {verdict === "good"
          ? "Nothing beats your plan by enough to bother."
          : verdict === "bad"
            ? <>You could save <span className={styles.amount}>{whole(shown)}</span> a year</>
            : <>The cheapest plan saves up to <span className={styles.amount}>{whole(shown)}</span> a year</>}
      </h2>
      {verdict !== "good" && savingYear > 0 && (
        <p className={styles.heroHow}>
          {!names
            ? "Plus members see which retailer and plan."
            : samePlace
              ? <>by moving to <b>{top.plan[0]}&apos;s &ldquo;{top.plan[2]}&rdquo;</b>. You stay with {top.plan[0]}: no switching.</>
              : <>by switching to <b>{top.plan[0]}</b>, &ldquo;{top.plan[2]}&rdquo;.</>}
          <span className={styles.heroFromTo}>
            {haveBill ? "Your bill" : "The default offer"} {whole(you * perYear)} a year → {names ? top.plan[0] : "the cheapest plan"} {whole(top.total * perYear)}
          </span>
        </p>
      )}
      {/* "Don't bother switching" (2 Nov 2026): saying so plainly is the proof we're independent. */}
      {verdict === "good" && (
        <p className={styles.stayPut}>
          <b>Stay put.</b> The best plan for you saves {savingYear >= 1 ? `about ${whole(savingYear)}` : "nothing"} a year, under the {whole(WORTH_SWITCHING_PER_YEAR)} we think is worth the hassle of switching.{" "}
          {member ? "We'll tell you the day that changes." : "Prices move, so check again in a few months."}
        </p>
      )}
      {/* The bill and its usage don't add up: still worth saying, it changes the number. */}
      {c.mismatch && (
        <div className={styles.facts}>
          <MismatchNote m={c.mismatch} member={member} />
        </div>
      )}
      <div className={styles.verdictActions}>
        {!names && (
          <a href="#membership" className={styles.go}><Icon name="lock" size={15} /> See which retailer →</a>
        )}
        {names && verdict !== "good" && link && (
          <a href={link} data-plan={top.plan[2]} data-network={input.distributor} data-same={samePlace ? "1" : undefined} target="_blank" rel="noopener noreferrer" className={styles.go}>
            {samePlace ? `Change plan with ${top.plan[0]} →` : `Go to ${top.plan[0]} →`}
          </a>
        )}
        {member && verdict !== "good" && savingYear > 0 && (
          <SwitchReminder retailer={top.plan[0]} plan={top.plan[2]} savingYear={savingYear} link={link} nmi={input.nmi} dark same={samePlace} />
        )}
        {!haveBill && <a href={member ? "#read-bill" : "/check"} className={styles.ghost}>Upload your bill for your real numbers</a>}
      </div>
      <p className={styles.fine}>
        {c.average
          ? `Priced today for the average Victorian home (${AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year), because we don't have enough of your usage yet.`
          : input.billIsPriced
            ? `Priced today for the plan you switched to, on the usage from your last bill (${days} days), shown a year.`
            : `Priced today from ${source === "bill" ? `your last bill (${days} days)` : "your answers"}, shown a year.`}
        {member ? " Re-checked every morning; we email you only when a move is worth it." : " Estimates only; confirm with the retailer before switching."}
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
          {member && <a href="#read-bill">Or upload the bill</a>}
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
export function MemberMarket({ input, member, compact = false, only, noRewards = false }: {
  input: ComparisonInput;
  member: boolean;
  compact?: boolean;
  /** The phone's Market and Rewards tabs: that section in full, on the page. "rewardsCard": just the rewards card (the Savings tab). */
  only?: "market" | "rewards" | "rewardsCard";
  /** Side column: leave the rewards card out (the Savings tab already shows it). */
  noRewards?: boolean;
}) {
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
    const who = (r: string) => (member || FREE_SHOWS_NAMES ? r : "One of them");
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
  if (only === "market") {
    const events = marketEvents({ days: 30, network: input.distributor });
    return <MarketDetail c={c} input={input} member={member} personal={personal} events={events} onClose={() => {}} inline />;
  }
  if (only === "rewards") {
    const against = c.haveBill ? "your bill" : "the default offer";
    return <MarketRewards matches={c.matches} you={c.you} perYear={c.perYear} against={against} locked={new Set(lockedTopFor(c, member)) as Set<unknown>} whole={whole} />;
  }
  if (only === "rewardsCard") {
    const events = marketEvents({ days: 30, network: input.distributor });
    return (
      <>
        <RewardsSideCard items={rewards} locked={new Set(lockedTopFor(c, member))} onOpen={() => setOpen("rewards")} wide />
        {open && <MarketDetail c={c} input={input} member={member} personal={personal} events={events} startAt={open} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (compact) {
    const events = marketEvents({ days: 30, network: input.distributor });
    return (
      <>
        {personal.checked > 0 && <MarketSideCard personal={personal} events={events} onOpen={() => setOpen("top")} />}
        {!noRewards && <RewardsSideCard items={rewards} locked={new Set(lockedTopFor(c, member))} onOpen={() => setOpen("rewards")} />}
        {open && <MarketDetail c={c} input={input} member={member} personal={personal} events={events} startAt={open} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (personal.checked === 0) return null;
  return <MarketBoard personal={personal} />;
}

/** The Compare tab: chart plus every comparable plan, ranked. Table on wide
 *  screens, one card per retailer on phones. */
export function CompareSection({ input: billInput, member, profile = null }: Omit<Props, "onPeriod"> & { chartPalette?: ResultsChartPalette; profile?: HomeProfile | null }) {
  // Top 6, then 10 more, then everything (1 Nov 2026).
  const [shownCount, setShownCount] = useState(6);
  // Which plan's rates are open (retailer + plan), on the table or the phone cards.
  const [openRates, setOpenRates] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState(false);
  // "What if my usage changes?": the whole comparison re-ranks for that usage.
  const [pctUse, setPctUse] = useState(100);
  const [evWhatIf, setEvWhatIf] = useState(false);
  const [season, setSeason] = useState<"none" | "winter" | "summer">("none");
  const seasons = useMemo(() => seasonFactors(profile), [profile]);
  const base = useMemo(() => compute(billInput), [billInput]);
  const whatIf = pctUse !== 100 || evWhatIf || season !== "none";
  const input = useMemo<ComparisonInput>(() => {
    if (!whatIf || !base || base.average) return billInput;
    const factor = (pctUse / 100) * (season === "winter" && seasons ? seasons.winter : season === "summer" && seasons ? seasons.summer : 1);
    const u2 = adjustUsage(base.usage, factor, evWhatIf ? WHATIF_EV_KWH_PER_DAY : 0);
    // What they'd pay at that usage on their own plan (their rates, or the bill split into supply and an average rate).
    const now = base.haveBill ? currentPricer({ rates: billInput.currentRates ?? null, network: billInput.distributor, you: base.you, base: base.usage })(u2) : null;
    return { ...billInput, peak: u2.peak, shoulder: u2.shoulder, offpeak: u2.offpeak, anytime: u2.anytime, cl: u2.cl, billTotal: now, billIsPriced: now !== null, ev: billInput.ev === true || evWhatIf };
  }, [whatIf, base, billInput, pctUse, season, seasons, evWhatIf]);
  const c = useMemo(() => compute(input), [input]);
  if (!c) return null;
  const resetWhatIf = () => { setPctUse(100); setEvWhatIf(false); setSeason("none"); };
  const { matches: allMatches, top, haveBill, you, vdo, offerFor } = c;
  // One row per retailer (its cheapest plan) unless they ask for every plan.
  const perRetailer = cheapestPerRetailer(allMatches, top);
  const matches = allPlans ? allMatches : perRetailer;
  const { days, currentRetailer, currentPlanName, source } = input;
  // 14 Nov 2026 (Phil): the member Compare tab is yearly throughout.
  const per = showPeriod("year", haveBill, days);
  const k = showScale(per, days);
  const perLabel = showLabel(per, days);
  // Each plan against the Victorian Default Offer for the same usage, as a percentage.
  const vsVdo = (total: number) => (vdo > 0 ? (total - vdo) / vdo : 0);
  const pct = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`; };
  // Each plan's "% vs default offer" on a standard home (4,000 kWh; time of use at 70/30), like retailers' own figure (4 Nov 2026).
  const stdVdo = (m: { plan: PlanRow }) => standardVsVdo(m.plan)?.pct ?? null;
  const vdoCell = (m: { plan: PlanRow }) => {
    const x = stdVdo(m);
    // 4 Nov 2026: the "New" / "Updated" bubble sits on the right-hand side of the row.
    const fresh = <OfferDate retailer={m.plan[0]} plan={m.plan[2]} badgeOnly short recentDays={7} />;
    if (x === null) return <td className={`${styles.num} ${styles.flat}`}>–<span className={styles.freshSide}>{fresh}</span></td>;
    const n = Math.round(x * 100);
    return <td className={`${styles.num} ${n < 0 ? styles.pos : n > 0 ? styles.neg : styles.flat}`}>{pct(x)}<span className={styles.freshSide}>{fresh}</span></td>;
  };
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
  // "Before you switch" and "Your rates vs the cheapest" stay on the real bill's
  // pick: a what-if re-ranks the table, not the recommendation.
  const real = base ?? c;
  const topOffer = real.offerFor(real.top.plan);
  const topDetail = billDetail(real.top.plan, real.usage);
  const lockedTop = lockedTopFor(c, member);
  const isLocked = (m: (typeof matches)[number] | null) => !!m && lockedTop.includes(m);
  const rows = matches.slice(0, shownCount);
  // How each plan relates to the one on their bill: "Your plan" only when the rates match.
  const relation = (m: (typeof matches)[number]) => planVsBill(m.plan, { retailer: currentRetailer ?? null, planName: currentPlanName ?? null, rates: input.currentRates ?? null });
  const names = member || FREE_SHOWS_NAMES;
  // Our pick, and the cheapest with no pay-on-time or direct-debit strings (from the real bill, not a what-if).
  const realOpen = real.matches.filter((m) => !m.restricted);
  const noStrings = realOpen.find((m) => (billDetail(m.plan, real.usage)?.conditionalDiscount ?? 0) < 0.005) ?? null;
  const showPick = names && real.top && (real.you - real.top.total) * real.perYear >= 1;
  // The pick's row in the list gets a box and an "Our pick" bubble.
  const isPick = (m: (typeof matches)[number]) => !!showPick && !!real.top && m.plan[0] === real.top.plan[0] && m.plan[2] === real.top.plan[2];

  // "Your options" (14 Nov 2026): stay and change plan; cheapest anywhere; cheapest with no conditions.
  const options: PlanOption[] = [];
  if (names && !real.cheapest) {
    const same = (r: string) => real.haveBill && sameRetailer(currentRetailer, r);
    const opt = (key: PlanOption["key"], m: (typeof realOpen)[number]): PlanOption => ({
      key, retailer: m.plan[0], plan: m.plan[2], cost: m.total * real.perYear, saving: (real.you - m.total) * real.perYear,
      pick: m.plan[0] === real.top.plan[0] && m.plan[2] === real.top.plan[2], same: same(m.plan[0]),
    });
    const seen = new Set<string>();
    const add = (o: PlanOption | null) => { if (!o) return; const id = `${o.retailer}|${o.plan}`; if (seen.has(id)) return; seen.add(id); options.push(o); };
    const stayPlan = real.haveBill && currentRetailer ? realOpen.find((m) => sameRetailer(currentRetailer, m.plan[0])) ?? null : null;
    if (stayPlan && (real.you - stayPlan.total) * real.perYear >= 1) add(opt("stay", stayPlan));
    const elsewhere = realOpen.find((m) => !same(m.plan[0])) ?? null;
    add(elsewhere ? opt("cheapest", elsewhere) : null);
    add(noStrings ? opt("nostrings", noStrings) : null);
  }

  return (
    <>
      {/* 14 Nov 2026: the "Staying with …?" lines became the first of these options. */}
      {!whatIf && <PlanOptions options={options} against={real.haveBill ? "your bill" : "the default offer"} network={input.distributor} />}

      <section className={styles.table}>
        <div className={styles.tableHead}>
          <h3>How you compare</h3>
          <PlanViewToggle all={allPlans} onChange={(v) => { setAllPlans(v); setShownCount(6); }} retailers={perRetailer.length} plans={allMatches.length} />
        </div>
        <div className={styles.chart}>
          <RankedBars
            items={matches.map((m) => ({ retailer: m.plan[0], plan: m.plan[2], value: m.total * k, locked: isLocked(m), pick: isPick(m) }))}
            you={you * k}
            youLabel={haveBill ? (c.basis === "rates" ? "Your plan" : "Your bill") : "Default offer"}
            vdo={haveBill ? vdo * k : null}
            per={perLabel}
            unit={allPlans ? "plans" : "retailers' best plans"}
            note={
              whatIf ? (
                <>What if: priced for about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {perLabel}</b> ({kwhDay.toFixed(1)} kWh a day){haveBill ? <>, on your plan&apos;s rates</> : null}. <button type="button" className={ins.wiReset} onClick={resetWhatIf}>Back to my bill</button></>
              ) : haveBill ? (
                <>
                  {source === "bill" ? "Your last bill" : "Your answers"}: about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {perLabel}</b> ({kwhDay.toFixed(1)} kWh a day){tariffWords ? `, ${tariffWords}` : ""}
                  {currentRetailer ? <> with {currentRetailer}</> : null}.{" "}
                  {Math.abs(vsVdo(you)) < 0.02
                    ? "About the same as the default offer."
                    : vsVdo(you) > 0
                      ? <><b className={styles.neg}>{pct(vsVdo(you)).replace(/^\+/, "")} more</b> than the default offer.</>
                      : "Under the default offer."}
                </>
              ) : c.average ? (
                <>The average Victorian home: <b>{AVERAGE_ANNUAL_KWH.toLocaleString("en-AU")} kWh a year</b>, on the default offer. Upload a full bill for your own numbers.</>
              ) : (
                <>The default offer at about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {perLabel}</b> ({kwhDay.toFixed(1)} kWh a day). Add your bill to compare against what you really pay.</>
              )
            }
          />
        </div>
        {base && !base.average && (
          <div className={`${ins.useBar} ${whatIf ? ins.useBarOn : ""}`} role="group" aria-labelledby="use-title">
            {/* 1 Nov 2026: says what it is, and what it does, before the slider. */}
            <div className={ins.useHead}>
              <span className={ins.useIcon} aria-hidden="true"><Icon name="chart" size={16} /></span>
              <div>
                <b id="use-title">What if you use more or less?</b>
                <span>Slide it, or tap a season. The chart and every price below re-rank for that usage.</span>
              </div>
            </div>
            <p className={ins.useResult} aria-live="polite">
              {whatIf ? <>What if: <b>{kwhDay.toFixed(1)} kWh a day</b> ({pctUse !== 100 ? `${pctUse}% of your bill` : "your bill"}{season !== "none" ? `, ${season}` : ""}{evWhatIf ? ", plus an EV" : ""}).</> : <>Now: <b>{kwhDay.toFixed(1)} kWh a day</b>, from your {source === "bill" ? "bill" : "answers"}.</>}{" "}
              Cheapest: <b className={ins.useBest}>{names ? top.plan[0] : "the cheapest plan"}, {whole(top.total * c.perYear)} a year</b>
              {haveBill ? <>, against {whole(you * c.perYear)} on your plan{whatIf ? " at that usage" : ""}</> : null}.
            </p>
            <div className={ins.wiSlider}>
              <label htmlFor="use-range" className={ins.srOnly}>Usage, as a share of your bill</label>
              <input id="use-range" type="range" min={50} max={200} step={5} value={pctUse} onChange={(e) => setPctUse(Number(e.target.value))} aria-describedby="use-hint" aria-valuetext={`${pctUse}% of your bill, ${kwhDay.toFixed(1)} kWh a day`} />
              {/* Ticks sit where those values are on the slider (50% to 200%), so "Your bill" lines up with the thumb. */}
              <div className={ins.useTicks} id="use-hint">
                <span style={{ left: "0%" }}>Half</span>
                <span style={{ left: `${((100 - 50) / 150) * 100}%` }} className={ins.useTickBill}>Your bill</span>
                <span style={{ left: `${((150 - 50) / 150) * 100}%` }}>1.5×</span>
                <span style={{ left: "100%" }}>Double</span>
              </div>
            </div>
            <div className={`${ins.wiChips} ${ins.wiChipsRow}`}>
              {seasons && (
                <>
                  <button type="button" aria-pressed={season === "winter"} className={`${ins.shift} ${season === "winter" ? ins.shiftOn : ""}`} onClick={() => setSeason(season === "winter" ? "none" : "winter")}>
                    <span className={ins.shiftTop}><Icon name="snow" size={15} /> Winter</span> <small>{seasons.winter >= 1 ? "+" : ""}{Math.round((seasons.winter - 1) * 100)}%</small>
                  </button>
                  <button type="button" aria-pressed={season === "summer"} className={`${ins.shift} ${season === "summer" ? ins.shiftOn : ""}`} onClick={() => setSeason(season === "summer" ? "none" : "summer")}>
                    <span className={ins.shiftTop}><Icon name="sun" size={15} /> Summer</span> <small>{seasons.summer >= 1 ? "+" : ""}{Math.round((seasons.summer - 1) * 100)}%</small>
                  </button>
                </>
              )}
              {billInput.ev !== true && (
                <button type="button" aria-pressed={evWhatIf} className={`${ins.shift} ${evWhatIf ? ins.shiftOn : ""}`} onClick={() => setEvWhatIf(!evWhatIf)}>
                  <span className={ins.shiftTop}><Icon name="car" size={15} /> <span><span className={ins.evLong}>Add an </span>EV</span></span> <small>+{WHATIF_EV_KWH_PER_DAY} kWh a day</small>
                </button>
              )}
              {whatIf && <button type="button" className={ins.wiReset} onClick={resetWhatIf}>Back to my bill</button>}
            </div>
          </div>
        )}


        {/* Wide screens: the full table */}
        <div className={styles.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th>Rates</th><th className={styles.num}>Cost {perLabel}</th><th className={styles.num}>vs {haveBill ? "your bill" : "default offer"}</th><th className={styles.num} title="Each plan against the Victorian Default Offer for a standard home: 4,000 kWh a year, time-of-use plans at 70% peak and 30% off-peak against the time-of-use default offer">vs default offer*</th></tr>
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
                      {vdoCell(m)}
                    </tr>
                  );
                }
                const key = `${m.plan[0]}|${m.plan[2]}`;
                return (
                  <Fragment key={key + i}>
                  <tr className={`${m === top ? styles.rowBest : mine ? styles.rowMine : ""} ${isPick(m) ? styles.rowPick : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <td>{i + 1}</td>
                    <td>
                      {isPick(m) && <span className={styles.pickBubble}>Our pick</span>}
                      <span className={styles.retailerCell}>
                        <RetailerLogo name={m.plan[0]} size={28} />
                        <RetailerLink name={m.plan[0]} />
                      </span>
                      {m === top && !isPick(m) && <span className={styles.tagBest}>{m !== c.cheapestPlan ? "Our pick" : i === 0 ? "Cheapest" : "Cheapest you can get"}</span>}
                      {m === c.cheapestPlan && m !== top && <span className={styles.tagBest}>Cheapest today</span>}
                      {mine && (() => { const rel = relation(m); return rel ? <span className={rel === "newRates" ? styles.tagNewRates : styles.tagMine} title={PLAN_VS_BILL_TAG[rel].help}>{PLAN_VS_BILL_TAG[rel].short}</span> : null; })()}
                      {input.ev && isEvFriendly(m.plan) && <span className={styles.tagEv}><Icon name="bolt" size={12} /> EV charging</span>}
                    </td>
                    <td className={styles.planName}>{m.plan[2]}<span className={styles.offerChips}><OfferChips o={offerFor(m.plan)} /><ComplaintBadge retailer={m.plan[0]} /></span></td>
                    <td title={chargeHelp(m.plan)}>
                      {/* 4 Nov 2026: single-rate plans say nothing here (customers know they're on one rate). */}
                      {m.plan[5] === null && <>Cheaper at night<br /></>}
                      {planPriceType(m.plan[0], m.plan[2]) === "fixed" && <><span className={styles.ptFixed}><Icon name="lock" size={12} /> Fixed</span><br /></>}
                      <button type="button" className={styles.ratesToggle} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                        {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                      </button>
                    </td>
                    <td className={styles.num}>{money(m.total * k)}</td>
                    <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                    {vdoCell(m)}
                  </tr>
                  {openRates === key && (
                    <tr key={`${key}-rates`} className={styles.ratesDetailRow}>
                      <td colSpan={7}>
                        <div className={styles.ratesDetail}>
                          <RatesCompare current={input.currentRates ?? null} plan={m.plan} planLabel={m.plan[0]} compact />
                          <PriceAddsUp plan={m.plan} usage={c.usage} scale={k} periodLabel={perLabel} />
                          <p className={styles.ratesFine}><OfferDate retailer={m.plan[0]} plan={m.plan[2]} /></p>
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
              <li key={key + i} className={`${styles.pc} ${m === top ? styles.rowBest : mine ? styles.rowMine : ""} ${isPick(m) ? styles.rowPick : ""}`}>
                {isPick(m) && <span className={styles.pickBubble}>Our pick</span>}
                <span className={styles.pcRank}>{i + 1}</span>
                <div className={styles.pcMain}>
                  <div className={styles.pcTop}>
                    <RetailerLogo name={m.plan[0]} size={26} />
                    <RetailerLink name={m.plan[0]} />
                    {m === top && !isPick(m) && <span className={styles.tagBest}>{m !== c.cheapestPlan ? "Our pick" : i === 0 ? "Cheapest" : "Best you can get"}</span>}
                    {m === c.cheapestPlan && m !== top && <span className={styles.tagBest}>Cheapest today</span>}
                    {mine && (() => { const rel = relation(m); return rel ? <span className={rel === "newRates" ? styles.tagNewRates : styles.tagMine} title={PLAN_VS_BILL_TAG[rel].help}>{PLAN_VS_BILL_TAG[rel].short}</span> : null; })()}
                  </div>
                  <span className={styles.pcPlan}>{m.plan[2]}{m.plan[5] === null ? " · Cheaper at night" : ""}{planPriceType(m.plan[0], m.plan[2]) === "fixed" ? " · Fixed price" : ""}</span>
                  <span className={styles.offerChips}><OfferChips o={offerFor(m.plan)} /><ComplaintBadge retailer={m.plan[0]} /></span>
                </div>
                <div className={styles.pcNums}>
                  <b>{whole(m.total * k)}</b>
                  <span className={diff >= 0 ? styles.pos : styles.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>
                  <div className={styles.freshPc}><OfferDate retailer={m.plan[0]} plan={m.plan[2]} badgeOnly short noDate recentDays={7} /></div>
                </div>
                <button type="button" className={`${styles.ratesToggle} ${styles.pcRates}`} aria-expanded={openRates === key} onClick={() => setOpenRates((x) => (x === key ? null : key))}>
                  {openRates === key ? "Hide rates" : "See rates"} <span aria-hidden="true">{openRates === key ? "▴" : "▾"}</span>
                </button>
                {stdVdo(m) !== null && <span className={styles.pcVdoRow}>{vdoWords(stdVdo(m)!)}</span>}
                {openRates === key && (
                  <div className={`${styles.ratesDetail} ${styles.pcRatesDetail}`}>
                    <RatesCompare current={input.currentRates ?? null} plan={m.plan} planLabel={m.plan[0]} compact />
                    <PriceAddsUp plan={m.plan} usage={c.usage} scale={k} periodLabel={perLabel} />
                    <p className={styles.ratesFine}><OfferDate retailer={m.plan[0]} plan={m.plan[2]} /></p>
                    <p className={styles.ratesFine}>Including GST, before discounts.{input.currentRates ? " ✓ marks the better rate." : ""}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {matches.length > 6 && (
          <div className={styles.moreRow}>
            {shownCount < matches.length && shownCount < 16 && matches.length > 16 && (
              <button type="button" className={styles.more} onClick={() => setShownCount(16)}>Show the next {Math.min(10, matches.length - shownCount)} ▾</button>
            )}
            {shownCount < matches.length && (
              <button type="button" className={styles.more} onClick={() => setShownCount(matches.length)}>{allPlans ? `Show all ${matches.length} plans` : `Show all ${matches.length} retailers`} ▾</button>
            )}
            {shownCount > 6 && (
              <button type="button" className={styles.more} onClick={() => setShownCount(6)}>Show the top 6 ▴</button>
            )}
          </div>
        )}
        <details className={styles.legendBox}>
          <summary>What the columns and labels mean</summary>
          <div className={styles.legend}>
          <span><b>vs default offer*</b>: each plan against the Victorian Default Offer for a standard home, the way retailers quote it: 4,000 kWh a year, with discounts for paying on time. Time-of-use plans are taken as 70% peak and 30% off-peak and compared with the time-of-use default offer; single-rate plans with the flat one. Minus (or &ldquo;below&rdquo;) is cheaper. Your own prices and savings use your bill.</span>
          <span><b>Labels</b>: ✓ green discounts are in the price (we assume you pay on time); blue ones (credits, other conditions) aren&apos;t; amber ! means who can get it is limited, or a fee to know about. Concessions aren&apos;t counted.</span>
          <span><b>Rates</b>: blank means one rate for every kWh. <b>Cheaper at night</b>: dearer late afternoon to evening, cheaper overnight.</span>
          <span><b>New</b> / <b>Updated</b>: the retailer launched the offer, or changed its rates or terms, in the last week.</span>
          <span><b><Icon name="lock" size={12} /> Fixed</b>: price locked for a set time. Everything else can change with notice, usually around 1 July.</span>
          {!input.ev && <span>Plans built around EV charging are hidden. Tell us you charge an EV to include them.</span>}
          </div>
        </details>
        {!member && (
          <p className={styles.upsell}>
            That&apos;s today&apos;s answer. Plus keeps watching: this table re-run every morning, a warning before your discount ends, and an email the day something cheaper appears.{" "}
            <Link href="#membership">See Utilo Plus</Link>
          </p>
        )}
      </section>

      <CurrentPricing input={billInput} usage={real.usage} best={real.top.plan} bestTotal={real.top.total} you={real.you} haveBill={real.haveBill} hideName={!(member || FREE_SHOWS_NAMES)} />

      {/* "Before you switch" sits at the bottom (1 Nov 2026). */}
      {!(member || FREE_SHOWS_NAMES) ? (
        <section className={styles.table}>
          <div className={styles.tableHead}>
            <h3>Before you switch</h3>
            <p>Plus members see the cheapest plan&apos;s retailer, discounts, sign-up conditions, credits and fees here, from the retailer&apos;s own price feed.</p>
          </div>
          <a href="#membership" className={styles.go}><Icon name="lock" size={15} /> Unlock the cheapest plans →</a>
        </section>
      ) : (
      <details className={`${styles.table} ${styles.foldCard}`}>
        <summary className={styles.foldHead}>
          <span>
            <h3>Before you switch to {real.top.plan[0]}</h3>
            <p>Discounts, sign-up conditions, credits and fees for &ldquo;{real.top.plan[2]}&rdquo;.</p>
          </span>
          <span className={styles.foldChev} aria-hidden="true">▾</span>
        </summary>
        <OfferTerms
          o={topOffer}
          retailer={real.top.plan[0]}
          title={null}
          payLateCost={topDetail && topDetail.conditionalDiscount * k >= 0.5 ? `${money(topDetail.conditionalDiscount * k)} ${perLabel}` : null}
        />
      </details>
      )}

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
  // One "Usage" row for one price all day; peak / off-peak only for time of use (2 Nov 2026).
  const rows: Row[] = rateRows(r, best, { cl: input.cl > 0 || (r?.cl ?? null) !== null, solar: input.solarExportKwh > 0 || (r?.solarFit ?? null) !== null })
    .map((x) => ({ label: x.label, you: x.you, best: x.plan, perDay: x.perDay, lowerIsBetter: x.higherIsBetter ? false : undefined }));
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
function MarketDetail({ c, input, member, personal, events, onClose, startAt = "top", inline = false }: {
  c: NonNullable<ReturnType<typeof compute>>;
  input: ComparisonInput;
  member: boolean;
  personal: MarketPersonal;
  events: MarketEvent[];
  onClose: () => void;
  startAt?: "top" | "rewards";
  /** Inline (the phone's Market tab): no overlay, no back buttons, no rewards (they have their own tab). */
  inline?: boolean;
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
    if (inline) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose, inline]);
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
  const body = (
      <div className={`${styles.mdBody} ${inline ? styles.mdInline : ""}`}>
        <h2 id="md-title" className={styles.mdTitle}>Your market this month</h2>
        <p className={styles.mdLede}>Every offer that changed on your network, priced for your home against {against}.</p>

        <div className={styles.mdTiles}>
          <div className={styles.mdTile}><b>{personal.checked}</b><span>changed offers checked for you</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileGood}`}><b>{personal.beat}</b><span>beat {against} by ${WORTH_SWITCHING_PER_YEAR}+ a year</span></div>
          <div className={styles.mdTile}><b>{cheaper}</b><span>of {perRet.length} retailers are cheaper than {against}</span></div>
          <div className={`${styles.mdTile} ${styles.mdTileSave}`}><b>{whole(bestSave)}</b><span>a year: the most you could save{(member || FREE_SHOWS_NAMES) && best ? `, with ${best.plan[0]}` : ""}</span></div>
        </div>

        <section className={styles.mdCard} aria-labelledby="md-chart">
          <h3 id="md-chart">Changes by day</h3>
          <p className={styles.mdSub}>{newOffers} new offers and {events.length - newOffers} updated offers in 30 days.</p>
          <DayChanges events={events} />
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

        {!inline && <MarketRewards matches={c.matches} you={c.you} perYear={c.perYear} against={against} locked={locked as Set<unknown>} whole={whole} />}

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
        {!inline && <button type="button" className={styles.mdBackBottom} onClick={onClose}>← Back to my dashboard</button>}
      </div>
  );
  if (inline) return body;
  return createPortal(
    <div className={styles.mdOverlay} role="dialog" aria-modal="true" aria-labelledby="md-title">
      <div className={styles.mdBar}>
        <button type="button" className={styles.mdBack} onClick={onClose}>← Back to my dashboard</button>
        <span className={styles.mdNet}>{input.distributor} network · last 30 days</span>
      </div>
      {body}
    </div>,
    document.body,
  );
}
