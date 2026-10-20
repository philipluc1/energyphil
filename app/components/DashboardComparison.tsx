"use client";

import OfferDate from "./OfferDate";
import Icon from "./Icon";
import { useMemo, useState } from "react";
import Link from "next/link";
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
  /** What they paid for `days` on their last bill, if we know it. */
  billTotal: number | null;
  currentRetailer: string | null;
  currentPlanName: string | null;
  source: "bill" | "answers";
  /** From the bill, when we have it. */
  nmi?: string | null;
  currentRates?: CurrentRates | null;
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
function compute(input: ComparisonInput) {
  // Not enough usage on file (none, under a week, or under 1 kWh a day
  // without solar)? Use the average Victorian home, 4,000 kWh a year.
  const { usage, average } = usageOrAverage({ days: input.days, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, anytime: input.anytime, cl: input.cl, solarExportKwh: input.solarExportKwh });
  const household = { hasSolar: input.solarExportKwh > 0, currentRetailer: input.currentRetailer ?? null };
  const matches = rankPlans(input.distributor, usage, { ev: input.ev === true, ...household });
  // Cheapest plan this household can get; offers needing a membership and so on stay listed.
  const top = topOpen(matches);
  if (!top || input.days <= 0) return null;
  const offerFor = (p: PlanRow) => describeOffer("E", p[0], p[2], p[1], household);
  const perYear = 365 / input.days;
  // A bill total for usage that thin can't be compared with the average home.
  const haveBill = !average && input.billTotal !== null && input.billTotal > 0;
  const vdo = vdoBillForUsage(input.distributor, usage);
  const you = haveBill ? (input.billTotal as number) : vdo;
  const savingYear = Math.max(0, (you - top.total) * perYear);
  const cheapest = haveBill && savingYear < WORTH_SWITCHING_PER_YEAR;
  const verdict: ComparisonSummary["verdict"] = haveBill ? (cheapest ? "good" : "bad") : "estimate";
  const severe = verdict === "bad" && (savingYear >= OVERPRICED_PER_YEAR || savingYear >= you * perYear * OVERPRICED_SHARE);
  return { matches, top, haveBill, you, vdo, savingYear, cheapest, verdict, severe, perYear, usage, offerFor, average };
}

/** Free users: the two cheapest plans (and anything above the cheapest one
 *  anyone can get) are for members, the same rule as the results page. */
function lockedTopFor(c: NonNullable<ReturnType<typeof compute>>, member: boolean) {
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
  const k = c ? PERIOD_DAYS[period] / input.days : 0;
  const shown = useCountUp(c ? c.savingYear * (PERIOD_DAYS[period] / 365) : 0);
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
        <div className={styles.toggle} role="tablist" aria-label="Show figures per">
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
      <div className={styles.versus}>
        <div className={styles.side}>
          <span className={styles.sideLabel}>{haveBill ? "You now" : "Default offer"}</span>
          <b>{haveBill ? currentRetailer ?? "Your current plan" : "VDO"}</b>
          <span className={styles.sidePlan}>{haveBill ? currentPlanName ?? "from your bill" : `${distributor} network`}</span>
          <span className={styles.sideCost}>{money(you * k)}</span>
          {haveBill && input.currentPriceType === "fixed" && (
            <span className={styles.sideTerms}><Icon name="lock" size={12} /> Fixed price{input.currentFixedUntil ? ` until ${fmtDay(input.currentFixedUntil)}` : ""}</span>
          )}
        </div>
        <div className={styles.arrow} aria-hidden="true">→</div>
        <div className={`${styles.side} ${styles.sideBest}`}>
          <span className={styles.sideLabel}>Cheapest we found</span>
          {member ? (
            <>
              <b>{top.plan[0]}</b>
              <span className={styles.sidePlan}>{top.plan[2]}</span>
            </>
          ) : (
            <>
              <b className={styles.sideLocked}><Icon name="lock" size={16} /> Members see which</b>
              <span className={styles.sidePlan}>Retailer and plan hidden</span>
            </>
          )}
          <span className={styles.sideCost}>{money(top.total * k)}</span>
          {member && bestTerms === "fixed" && <span className={styles.sideTerms}><Icon name="lock" size={12} /> Fixed price</span>}
          {member && <span className={styles.sideChips}><OfferChips o={c.offerFor(top.plan)} /></span>}
        </div>
        {verdict !== "good" && savingYear > 0 && (
          <>
            <div className={styles.arrow} aria-hidden="true">=</div>
            <div className={`${styles.side} ${styles.sideSave}`}>
              <span className={styles.sideLabel}>You save</span>
              <b>By switching</b>
              <span className={styles.sidePlan}>{PERIOD_LABEL[period]}, to {member ? top.plan[0] : "the cheapest plan"}</span>
              <span className={styles.sideCost}>{money((you - top.total) * k)}</span>
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
          : `Priced today from ${source === "bill" ? "your last bill" : "your answers"}`}{" "}({days}-day period, shown {PERIOD_LABEL[period]}).
        {member ? " We re-run this every morning and email you only when a move is worth it." : " Estimates only; confirm with the retailer before switching."}
      </p>
    </section>
  );
}

/** The Compare tab: chart plus every comparable plan, ranked. Table on wide
 *  screens, one card per retailer on phones. */
export function CompareSection({ input, member, period }: Omit<Props, "onPeriod"> & { chartPalette?: ResultsChartPalette }) {
  const [showAll, setShowAll] = useState(false);
  const [allPlans, setAllPlans] = useState(false);
  const c = useMemo(() => compute(input), [input]);
  if (!c) return null;
  const { matches: allMatches, top, haveBill, you, vdo, offerFor } = c;
  // One row per retailer (its cheapest plan) unless they ask for every plan.
  const perRetailer = cheapestPerRetailer(allMatches, top);
  const matches = allPlans ? allMatches : perRetailer;
  const { distributor, days, currentRetailer, currentPlanName, source } = input;
  const k = PERIOD_DAYS[period] / days;
  // Each plan against the Victorian Default Offer for the same usage, as a percentage.
  const vsVdo = (total: number) => (vdo > 0 ? (total - vdo) / vdo : 0);
  const pct = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`; };
  const u = c.usage;
  const kwhPeriod = (u.peak + u.shoulder + u.offpeak + u.anytime + u.cl) * k;
  const kwhDay = days > 0 ? (u.peak + u.shoulder + u.offpeak + u.anytime + u.cl) / days : 0;
  const tariffWords =
    (input.currentRates
      ? input.currentRates.anytime !== null ? "a single-rate tariff" : input.currentRates.peak !== null ? "a time-of-use tariff" : "your tariff"
      : input.peak + input.shoulder + input.offpeak > 0 ? "a time-of-use tariff" : "a single-rate tariff") +
    (input.cl > 0 ? " with controlled load" : "");
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
          Members see which one, so you can ask {currentRetailer} to move you without changing company.
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
            youLabel={haveBill ? "Your bill" : "The default offer"}
            vdo={haveBill ? vdo * k : null}
            per={PERIOD_LABEL[period]}
          />
        </div>

        {/* What we're comparing against, right before the results */}
        <div className={styles.youBox}>
          <div className={styles.youMain}>
            <span className={styles.youLabel}>{haveBill ? "Your current bill" : "The default offer (VDO)"}</span>
            <b className={styles.youCost}>{money(you * k)} <small>{PERIOD_LABEL[period]}</small></b>
          </div>
          <p className={styles.youText}>
            {haveBill ? (
              <>
                Based on {source === "bill" ? "your last bill" : "your answers"}: about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}</b> ({kwhDay.toFixed(1)} kWh a day) on {tariffWords}
                {currentRetailer ? <> with {currentRetailer}{currentPlanName ? <>, &ldquo;{currentPlanName}&rdquo;</> : null}</> : null}.{" "}
                {vsVdo(you) > 0 ? (
                  <>That&apos;s <b className={styles.neg}>{pct(vsVdo(you))}</b> against the default offer ({money(vdo * k)} {PERIOD_LABEL[period]}) for the same usage.</>
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
                The Victorian Default Offer priced at about <b>{Math.round(kwhPeriod).toLocaleString("en-AU")} kWh {PERIOD_LABEL[period]}</b> ({kwhDay.toFixed(1)} kWh a day) on {tariffWords}. Add your bill to compare against what you really pay.
              </>
            )}
          </p>
        </div>

        {/* Wide screens: the full table */}
        <div className={styles.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th>How it&apos;s charged</th><th className={styles.num}>Cost {PERIOD_LABEL[period]}</th><th className={styles.num}>vs {haveBill ? "your bill" : "default offer"}</th><th className={styles.num} title="Each plan against the Victorian Default Offer for the same usage">vs VDO</th></tr>
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
                          <a href="#membership">{i === 0 ? "The cheapest plan: members see which" : "Members see this plan"}</a>
                        </span>
                      </td>
                      <td className={styles.num}>{money(m.total * k)}</td>
                      <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                      <td className={`${styles.num} ${Math.round(vsVdo(m.total) * 100) < 0 ? styles.pos : Math.round(vsVdo(m.total) * 100) > 0 ? styles.neg : styles.flat}`}>{pct(vsVdo(m.total))}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={m.plan[0] + m.plan[2] + i} className={m === top ? styles.rowBest : mine ? styles.rowMine : ""} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
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
                    </td>
                    <td className={styles.num}>{money(m.total * k)}</td>
                    <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                    <td className={`${styles.num} ${Math.round(vsVdo(m.total) * 100) < 0 ? styles.pos : Math.round(vsVdo(m.total) * 100) > 0 ? styles.neg : styles.flat}`}>{pct(vsVdo(m.total))}</td>
                  </tr>
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
                    <a className={styles.pcPlan} href="#membership">Members see this plan</a>
                  </div>
                  <div className={styles.pcNums}>
                    <b>{whole(m.total * k)}</b>
                    <span className={diff >= 0 ? styles.pos : styles.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>
                  </div>
                </li>
              );
            }
            return (
              <li key={m.plan[0] + m.plan[2] + i} className={`${styles.pc} ${m === top ? styles.rowBest : mine ? styles.rowMine : ""}`}>
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
                  <span className={styles.pcVdo}>{pct(vsVdo(m.total))} vs VDO</span>
                </div>
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
          <span><b>vs VDO</b>: each plan against the Victorian Default Offer (the government-set reference price) for the same usage. Minus is cheaper.</span>
          <span><b>Labels</b>: ✓ green discounts are in the price (we assume you pay on time); blue ones (credits, other conditions) aren&apos;t; amber ! means who can get it is limited, or a fee to know about. Concessions aren&apos;t counted.</span>
          <span><b>Same price all day</b>: one rate for every kWh.</span>
          <span><b>Cheaper at night</b>: dearer late afternoon to evening, cheaper overnight.</span>
          <span><b><Icon name="lock" size={12} /> Fixed</b>: price locked for a set time. Everything else can change with notice, usually around 1 July.</span>
          {!input.ev && <span>Plans built around EV charging are hidden. Tell us you charge an EV to include them.</span>}
        </div>
        {!member && (
          <p className={styles.upsell}>
            Members get this table re-run every morning, a bill read every month, and an email the day something cheaper appears.{" "}
            <Link href="#membership">See plans</Link>
          </p>
        )}
      </section>

      {!member ? (
        <section className={styles.table}>
          <div className={styles.tableHead}>
            <h3>Before you switch</h3>
            <p>Members see the cheapest plan&apos;s retailer, discounts, sign-up conditions, credits and fees here, from the retailer&apos;s own price feed.</p>
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

  const fmt = (v: number | null, perDay?: boolean) =>
    v === null ? "–" : perDay ? fmtRatePerDay(v) : v === 0 ? "Free (set hours)" : fmtRateCents(v);
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
            <span>{hideName ? "Members see which retailer" : `${best[0]} · ${best[2]}`}</span>
            <em className={bestTerms === "fixed" ? styles.badgeFixed : styles.badge}>{PRICE_TYPE_LABEL[bestTerms]}</em>
          </div>
        </div>
        {rows.map((row) => {
          const better = row.lowerIsBetter === false ? (a: number, b: number) => a > b : (a: number, b: number) => a < b;
          const youWorse = row.you !== null && row.best !== null && better(row.best, row.you);
          return (
            <div className={styles.ratesRow} key={row.label}>
              <span className={styles.ratesLabel}>{row.label}</span>
              <span className={youWorse ? styles.neg : ""}>{fmt(row.you, row.perDay)}</span>
              <span>{fmt(row.best, row.perDay)}</span>
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
