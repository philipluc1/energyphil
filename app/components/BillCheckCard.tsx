import type { BillCheck } from "@/lib/billCheck";
import s from "./billcheck.module.css";

const money = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export interface BillCheckFacts {
  /** The plan name printed on the bill. */
  billPlanName: string;
  /** Today's version of the same-name plan, and how much less it costs than the bill, when it's at least $20 a year. */
  olderVersion: { planName: string; perMonth: number; perYear: number } | null;
  /** The bill's plan matches one on sale today at about the same price. */
  planIsCurrent: boolean;
  /** The retailer's cheapest plan for this usage and the yearly saving against the bill. */
  retailerBest: { planName: string; savingPerYear: number } | null;
  retailerCount: number;
  /** Below this a saving isn't worth acting on ($ a year). */
  worthPerYear: number;
}

/** "We checked your bill": plan version, the retailer's own best offer
 *  message, estimated reads, concessions, and a warning about debt first. */
export default function BillCheckCard({ check, retailer, facts, title = "We checked your bill" }: { check: BillCheck; retailer: string; facts: BillCheckFacts; title?: string }) {
  const who = retailer || "your retailer";
  const behind = (check.overdue ?? 0) > 0 || check.paymentPlan;
  const { billPlanName, olderVersion, planIsCurrent, retailerBest } = facts;
  const bo = check.bestOffer;
  const checkedOn = check.checkedAt ? new Date(check.checkedAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <section className={s.card} aria-labelledby="bill-check-title">
      <h3 id="bill-check-title" className={s.title}>
        {title}
        {checkedOn && <small> · bill read {checkedOn}</small>}
      </h3>
      {behind && (
        <div className={s.alert}>
          <b>
            {check.overdue ? `Your bill shows ${money(check.overdue)} overdue` : "Your bill mentions a payment plan"}. Talk to {who} before you switch.
          </b>
          <span>
            Switching can end a payment arrangement, and the debt stays with your old retailer. From 1 October 2026, Victorian retailers must move customers
            who are struggling to pay onto their best offer, so ask for that first. Free, confidential help: National Debt Helpline{" "}
            <a href="tel:1800007007">1800 007 007</a>.
          </span>
        </div>
      )}
      <ul className={s.list}>
        {olderVersion && (
          <li className={s.warn}>
            <b>Same plan name, older price.</b> Your bill says &ldquo;{billPlanName}&rdquo;. {who}&apos;s current &ldquo;{olderVersion.planName}&rdquo; costs about{" "}
            {money(olderVersion.perMonth)} a month less for the same usage (about {whole(olderVersion.perYear)} a year). Ask {who} to move you to the current
            version: same company, no switch.
          </li>
        )}
        {!olderVersion && planIsCurrent && (
          <li className={s.ok}>
            <b>Your plan is current.</b> &ldquo;{billPlanName}&rdquo; matches {who}&apos;s plan on sale today.
          </li>
        )}
        {bo && (
          <li className={bo.saysOnBest && retailerBest && retailerBest.savingPerYear >= facts.worthPerYear ? s.warn : s.info}>
            <b>Your retailer&apos;s message.</b>{" "}
            {bo.saysOnBest ? (
              <>Your bill says you&apos;re on {who}&apos;s best offer.</>
            ) : (
              <>
                Your bill says you could save{bo.savingPerYear ? ` ${whole(bo.savingPerYear)} a year` : ""}
                {bo.planName ? <> on &ldquo;{bo.planName}&rdquo;</> : null}.
              </>
            )}{" "}
            {retailerBest &&
              (retailerBest.savingPerYear >= facts.worthPerYear ? (
                <>
                  We priced {who}&apos;s plans on your usage: &ldquo;{retailerBest.planName}&rdquo; is about {whole(retailerBest.savingPerYear)} a year less than your
                  bill.
                </>
              ) : (
                <>We agree: nothing from {who} beats your bill by {whole(facts.worthPerYear)} a year or more.</>
              ))}{" "}
            Retailers only compare their own plans; we compare {facts.retailerCount} retailers.
          </li>
        )}
        {check.readingType && (
          <li className={check.readingType === "actual" ? s.ok : s.warn}>
            {check.readingType === "actual" ? (
              <>
                <b>Actual meter read.</b> This bill uses a real reading, so the usage is reliable.
              </>
            ) : (
              <>
                <b>{check.readingType === "mixed" ? "Part" : "Estimated"} meter read.</b> The usage on this bill is a guess, so it may be too high or too low. Ask{" "}
                {who} for an actual read, or send them a photo of your meter. Our comparison uses the same estimate.
              </>
            )}
          </li>
        )}
        <li className={check.concession ? s.ok : s.info}>
          {check.concession ? (
            <>
              <b>Concession applied.</b> Give your card details again if you change retailer; it doesn&apos;t move with you.
            </>
          ) : (
            <>
              <b>No concession on this bill.</b> If you have a pensioner, health care or DVA card, ask {who} to add the Victorian annual electricity concession. It
              isn&apos;t automatic.
            </>
          )}
        </li>
      </ul>
    </section>
  );
}
