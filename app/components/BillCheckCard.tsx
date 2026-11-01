import type { ReactNode } from "react";
import type { BillCheck } from "@/lib/billCheck";
import { billIssues, issueSummary, type BillIssue, type BillMoney } from "@/lib/billIssues";
import { PLANS } from "@/lib/plans";
import s from "./billcheck.module.css";

/** The Victorian Government's own page on help paying energy bills. */
const HELP_URL = "https://energy.vic.gov.au/households/help-paying-your-bills";
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export interface BillCheckFacts {
  /** The plan name printed on the bill. */
  billPlanName: string;
  /** Today's version of the same-name plan, and how much less it costs than the bill, when it's at least $20 a year. */
  olderVersion: { planName: string; perMonth: number; perYear: number } | null;
  /** The bill's plan matches one on sale today at about the same price. */
  planIsCurrent: boolean;
  /** The retailer's cheapest plan for this usage, the yearly saving against the bill, and its tariff type. */
  retailerBest: { planName: string; savingPerYear: number; tariff?: "flat" | "tou" | null } | null;
  retailerCount: number;
  /** Below this a saving isn't worth acting on ($ a year). */
  worthPerYear: number;
  /** The bill's usage and rates, for "charges that look off" and "dearer than anything on sale". */
  money?: Omit<BillMoney, "total"> | null;
}

/**
 * "We checked your bill" (reworked 2 Nov 2026): one card, ranked. Things to
 * act on and things worth a look stay open; everything that checked out
 * folds into one line, so a clean bill takes almost no room.
 */
export default function BillCheckCard({ check, retailer, facts, title = "We checked your bill", explain }: {
  check: BillCheck;
  retailer: string;
  facts: BillCheckFacts;
  title?: string;
  /** The plain-English explainer, folded at the foot of the card (the dashboard). */
  explain?: ReactNode;
}) {
  // Only a payment plan or a real amount overdue (a small one is usually a payment that crossed with the bill).
  const behind = check.paymentPlan || (check.overdue ?? 0) >= 100;
  const list = billIssues({
    retailer,
    readingType: check.readingType,
    concession: check.concession,
    behind,
    paymentPlan: check.paymentPlan,
    bestOffer: check.bestOffer,
    fees: check.fees ?? [],
    discountLost: check.discountLost === true,
    billPlanName: facts.billPlanName,
    olderVersion: facts.olderVersion,
    planIsCurrent: facts.planIsCurrent,
    retailerBest: facts.retailerBest,
    retailerCount: facts.retailerCount,
    worthPerYear: facts.worthPerYear,
    money: facts.money ? { ...facts.money, total: check.newCharges ?? null } : null,
    plans: PLANS,
  });
  const open = list.filter((i) => i.level !== "ok");
  const ok = list.filter((i) => i.level === "ok");
  const sum = issueSummary(list);
  const checkedOn = check.checkedAt ? new Date(check.checkedAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : null;

  const item = (i: BillIssue) => (
    <li key={i.id} className={i.level === "ok" ? s.ok : i.level === "info" ? s.info : i.level === "act" ? `${s.warn} ${s.act}` : s.warn}>
      <b>{i.title}</b>
      {i.perYear && i.perYear >= 1 && i.level === "act" ? <span className={s.worth}>about {whole(i.perYear)} a year</span> : null} {i.body}
      {i.id === "behind" && (
        <>
          {" "}
          <a href={HELP_URL} target="_blank" rel="noopener noreferrer">Where to get help ↗</a>
        </>
      )}
    </li>
  );

  return (
    <section className={s.card} aria-labelledby="bill-check-title">
      <div className={s.head}>
        <h3 id="bill-check-title" className={s.title}>
          {title}
          {checkedOn && <small> · bill read {checkedOn}</small>}
        </h3>
        <span className={sum.flagged ? s.chipWarn : s.chipOk}>{sum.flagged ? sum.text : `✓ ${sum.text}`}</span>
      </div>
      {open.length > 0 && <ul className={s.list}>{open.map(item)}</ul>}
      {ok.length > 0 && (
        <details className={s.fold} open={open.length === 0}>
          <summary>✓ {ok.length} thing{ok.length === 1 ? "" : "s"} checked out</summary>
          <ul className={s.list}>{ok.map(item)}</ul>
        </details>
      )}
      {explain && (
        <details className={s.fold}>
          <summary className={s.explainSum}>Explain my bill ▾</summary>
          {explain}
        </details>
      )}
    </section>
  );
}
