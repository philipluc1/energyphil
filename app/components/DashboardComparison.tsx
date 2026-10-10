"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RETAILER_COUNT, rankPlans, isEvFriendly, fmtRateCents, fmtRatePerDay, type Distributor, type UsageInput, type PlanRow } from "@/lib/plans";
import { planPriceType, PRICE_TYPE_LABEL, PRICE_TYPE_HELP, type PriceType } from "@/lib/planTerms";
import type { CurrentRates } from "@/lib/billExtraction";
import SwitchReminder from "./SwitchReminder";
import type { ResultsChartPalette } from "@/lib/dashThemes";
import { vdoBillForUsage } from "@/lib/profileUsage";
import { RETAILER_LINKS } from "@/lib/retailerLinks";
import { WORTH_SWITCHING_PER_YEAR, OVERPRICED_PER_YEAR, OVERPRICED_SHARE } from "@/lib/dataPolicy";
import { useCountUp } from "@/lib/useCountUp";
import ResultsChart, { type ChartItem } from "./ResultsChart";
import FunEquivalents from "./FunEquivalents";
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
  const usage: UsageInput = { days: input.days, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, anytime: input.anytime, cl: input.cl, solarExportKwh: input.solarExportKwh };
  const matches = rankPlans(input.distributor, usage, { ev: input.ev === true });
  const top = matches[0];
  if (!top || input.days <= 0) return null;
  const perYear = 365 / input.days;
  const haveBill = input.billTotal !== null && input.billTotal > 0;
  const vdo = vdoBillForUsage(input.distributor, usage);
  const you = haveBill ? (input.billTotal as number) : vdo;
  const savingYear = Math.max(0, (you - top.total) * perYear);
  const cheapest = haveBill && savingYear < WORTH_SWITCHING_PER_YEAR;
  const verdict: ComparisonSummary["verdict"] = haveBill ? (cheapest ? "good" : "bad") : "estimate";
  const severe = verdict === "bad" && (savingYear >= OVERPRICED_PER_YEAR || savingYear >= you * perYear * OVERPRICED_SHARE);
  return { matches, top, haveBill, you, savingYear, cheapest, verdict, severe, perYear };
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
            <span className={styles.sideTerms}>🔒 Fixed price{input.currentFixedUntil ? ` until ${fmtDay(input.currentFixedUntil)}` : ""}</span>
          )}
        </div>
        <div className={styles.arrow} aria-hidden="true">→</div>
        <div className={`${styles.side} ${styles.sideBest}`}>
          <span className={styles.sideLabel}>Cheapest we found</span>
          <b>{top.plan[0]}</b>
          <span className={styles.sidePlan}>{top.plan[2]}</span>
          <span className={styles.sideCost}>{money(top.total * k)}</span>
          {bestTerms === "fixed" && <span className={styles.sideTerms}>🔒 Fixed price</span>}
        </div>
      </div>
      {verdict !== "good" && savingYear > 0 && <FunEquivalents dollars={savingYear} />}
      <div className={styles.verdictActions}>
        {verdict !== "good" && RETAILER_LINKS[top.plan[0]] && (
          <a href={RETAILER_LINKS[top.plan[0]]} target="_blank" rel="noopener noreferrer" className={styles.go}>Go to {top.plan[0]} →</a>
        )}
        {verdict !== "good" && savingYear > 0 && (
          <SwitchReminder retailer={top.plan[0]} plan={top.plan[2]} savingYear={savingYear} link={RETAILER_LINKS[top.plan[0]]} nmi={input.nmi} dark />
        )}
        {!haveBill && <a href={member ? "#savings" : "/check"} className={styles.ghost}>Upload your bill for your real numbers</a>}
      </div>
      <p className={styles.fine}>
        Priced today from {source === "bill" ? "your last bill" : "your answers"} ({days}-day period, shown {PERIOD_LABEL[period]}).
        {member ? " We re-run this every morning and email you only when a move is worth it." : " Estimates only; confirm with the retailer before switching."}
      </p>
    </section>
  );
}

/** The Compare tab: chart plus every comparable plan, ranked. Table on wide
 *  screens, one card per retailer on phones. */
export function CompareSection({ input, member, period, chartPalette }: Omit<Props, "onPeriod"> & { chartPalette?: ResultsChartPalette }) {
  const [showAll, setShowAll] = useState(false);
  const c = useMemo(() => compute(input), [input]);
  if (!c) return null;
  const { matches, top, haveBill, you, cheapest } = c;
  const { distributor, days, currentRetailer, currentPlanName } = input;
  const k = PERIOD_DAYS[period] / days;
  const youLabel = haveBill ? "Your current bill" : "Default offer (VDO)";
  const retailerBest = currentRetailer ? matches.find((m) => m.plan[0] === currentRetailer) ?? null : null;

  const chartItems: ChartItem[] = [
    ...matches.slice(0, 5).map((m, i) => ({ label: m.plan[0], sublabel: m.plan[2], value: m.total * k, kind: (i === 0 ? "cheapest" : "plan") as ChartItem["kind"] })),
    { label: haveBill ? "Your bill" : "Default offer (VDO)", sublabel: youLabel, value: you * k, kind: haveBill ? (cheapest ? "referenceGood" : "referenceBad") : "reference" },
  ];
  const rows = showAll ? matches : matches.slice(0, 10);

  return (
    <>
      {retailerBest && retailerBest !== top && (
        <div className={styles.stay}>
          <b>Staying with {currentRetailer}?</b> Their cheapest current plan for you is &ldquo;{retailerBest.plan[2]}&rdquo; at {money(retailerBest.total * k)} {PERIOD_LABEL[period]},{" "}
          <span className={styles.stayGap}>{whole((retailerBest.total - top.total) * k)} more</span> than {top.plan[0]}.
          {!haveBill && <> You may be on an older, dearer {currentRetailer} plan: upload your bill to see what you actually pay.</>}
        </div>
      )}

      <section className={styles.table}>
        <div className={styles.tableHead}>
          <h3>Retailer comparison</h3>
          <p>{matches.length} plans from the {RETAILER_COUNT} retailers we track on the {distributor} network (not every plan in the market), cheapest first, {PERIOD_LABEL[period]}. Tap a retailer to visit their website.</p>
        </div>
        <div className={styles.chart}><ResultsChart items={chartItems} palette={chartPalette} /></div>

        {/* Wide screens: the full table */}
        <div className={styles.tableWide}>
          <table>
            <thead>
              <tr><th>#</th><th>Retailer</th><th>Plan</th><th>How it&apos;s charged</th><th className={styles.num}>Cost {PERIOD_LABEL[period]}</th><th className={styles.num}>vs {haveBill ? "your bill" : "default offer"}</th></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const diff = (you - m.total) * k;
                const mine = currentRetailer && m.plan[0] === currentRetailer;
                return (
                  <tr key={m.plan[0] + m.plan[2] + i} className={i === 0 ? styles.rowBest : mine ? styles.rowMine : ""} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <td>{i + 1}</td>
                    <td>
                      <RetailerLink name={m.plan[0]} />
                      {i === 0 && <span className={styles.tagBest}>Cheapest</span>}
                      {mine && <span className={styles.tagMine}>Your retailer</span>}
                      {input.ev && isEvFriendly(m.plan) && <span className={styles.tagEv}>⚡ EV charging</span>}
                    </td>
                    <td className={styles.planName}>{m.plan[2]}</td>
                    <td title={chargeHelp(m.plan)}>
                      {chargeLabel(m.plan)}
                      {planPriceType(m.plan[0], m.plan[2]) === "fixed" && <span className={styles.ptFixed}> · 🔒 Fixed</span>}
                    </td>
                    <td className={styles.num}>{money(m.total * k)}</td>
                    <td className={`${styles.num} ${diff >= 0 ? styles.pos : styles.neg}`}>{diff >= 0 ? `save ${money(diff)}` : `+${money(-diff)}`}</td>
                  </tr>
                );
              })}
              <tr className={styles.rowRef}>
                <td>–</td><td><b>{youLabel}</b></td><td className={styles.planName}>{haveBill ? currentPlanName ?? "" : "Essential Services Commission"}</td>
                <td>{haveBill && input.currentPriceType === "fixed" ? <span className={styles.ptFixed}>🔒 Fixed</span> : ""}</td>
                <td className={styles.num}>{money(you * k)}</td><td className={styles.num}>–</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Phones: one card per plan */}
        <ol className={styles.cards}>
          {rows.map((m, i) => {
            const diff = (you - m.total) * k;
            const mine = currentRetailer && m.plan[0] === currentRetailer;
            return (
              <li key={m.plan[0] + m.plan[2] + i} className={`${styles.pc} ${i === 0 ? styles.rowBest : mine ? styles.rowMine : ""}`}>
                <span className={styles.pcRank}>{i + 1}</span>
                <div className={styles.pcMain}>
                  <div className={styles.pcTop}>
                    <RetailerLink name={m.plan[0]} />
                    {i === 0 && <span className={styles.tagBest}>Cheapest</span>}
                    {mine && <span className={styles.tagMine}>Yours</span>}
                  </div>
                  <span className={styles.pcPlan}>{m.plan[2]} · {chargeLabel(m.plan)}{planPriceType(m.plan[0], m.plan[2]) === "fixed" ? " · 🔒 Fixed" : ""}</span>
                </div>
                <div className={styles.pcNums}>
                  <b>{whole(m.total * k)}</b>
                  <span className={diff >= 0 ? styles.pos : styles.neg}>{diff >= 0 ? `save ${whole(diff)}` : `+${whole(-diff)}`}</span>
                </div>
              </li>
            );
          })}
          <li className={`${styles.pc} ${styles.rowRef}`}>
            <span className={styles.pcRank}>–</span>
            <div className={styles.pcMain}><b>{youLabel}</b><span className={styles.pcPlan}>{haveBill ? currentPlanName ?? "" : "Essential Services Commission"}</span></div>
            <div className={styles.pcNums}><b>{whole(you * k)}</b></div>
          </li>
        </ol>

        {matches.length > 10 && (
          <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show the top 10" : `Show all ${matches.length} plans`}
          </button>
        )}
        <div className={styles.legend}>
          <span><b>Same price all day</b>: one rate for every kWh.</span>
          <span><b>Cheaper at night</b>: dearer late afternoon to evening, cheaper overnight.</span>
          <span><b>🔒 Fixed</b>: price locked for a set time. Everything else can change with notice, usually around 1 July.</span>
          {!input.ev && <span>Plans built around EV charging are hidden. Tell us you charge an EV to include them.</span>}
        </div>
        {!member && (
          <p className={styles.upsell}>
            Members get this table re-run every morning, a bill read every month, and an email the day something cheaper appears.{" "}
            <Link href="#membership">See plans</Link>
          </p>
        )}
      </section>

      <CurrentPricing input={input} best={top.plan} bestTotal={top.total} you={you} haveBill={haveBill} />
    </>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}


/** Your current plan's rates (read off your bill) beside the cheapest plan's,
 *  plus fixed or variable, and the all-in average cents per kWh. */
function CurrentPricing({ input, best, bestTotal, you, haveBill }: { input: ComparisonInput; best: PlanRow; bestTotal: number; you: number; haveBill: boolean }) {
  const r = input.currentRates ?? null;
  const [, , , , bSupply, bAny, bPeak, bShoulder, bOff, bCl, bFit] = best;
  const kwh = input.peak + input.shoulder + input.offpeak + input.anytime + input.cl;
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
        <p>What you pay per day and per kWh now, beside {best[0]}. All prices include GST.</p>
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
            <span>{best[0]} · {best[2]}</span>
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
