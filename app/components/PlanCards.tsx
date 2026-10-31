import Link from "next/link";
import { PLAN_DISPLAY, PLANS_ON_SALE, fmtPrice, plusValue, type PlanId } from "@/lib/pricingPlans";
import styles from "./plancards.module.css";

/**
 * The Utilo Plus plans on sale, side by side: Monthly first as the anchor
 * ("$7 a month is $84 a year"), then Yearly with what it saves. Pass
 * `onChoose` to make the buttons start checkout, or `href` to link them.
 */
export default function PlanCards({
  onChoose,
  loadingPlan = null,
  href,
  cta = "Get started",
  dark = false,
}: {
  onChoose?: (id: PlanId) => void;
  loadingPlan?: PlanId | null;
  href?: string;
  cta?: string;
  dark?: boolean;
}) {
  const v = plusValue();
  // Monthly first: it sets the yardstick the yearly price is measured against.
  const plans = [...PLANS_ON_SALE].sort((a, b) => (a.id === "monthly" ? -1 : b.id === "monthly" ? 1 : 0));
  return (
    <div className={`${styles.grid} ${dark ? styles.dark : ""}`}>
      {plans.map((plan) => {
        const d = PLAN_DISPLAY[plan.id];
        const yearly = plan.id === "annual";
        return (
          <div key={plan.id} className={`${styles.card} ${d.featured ? styles.featured : ""}`}>
            {yearly && <span className={styles.ribbon}>Best value · save {v.save}</span>}
            <div className={styles.name}>{plan.name}</div>
            <div className={styles.priceRow}>
              {yearly && <span className={styles.anchor}>{v.monthlyYear}</span>}
              <span className={styles.price}>{fmtPrice(plan.priceCents)}</span>
              <span className={styles.per}>{yearly ? "/ year" : "/ month"}</span>
            </div>
            <div className={styles.value}>
              {yearly ? (
                <><b>You save {v.save} a year</b> ({v.savePct}% off monthly)</>
              ) : (
                <>That&apos;s <b>{v.monthlyYear} a year</b></>
              )}
            </div>
            <div className={styles.small}>{yearly ? "One payment a year · cancel any time" : "Month to month · cancel any time"}</div>
            {href ? (
              <Link href={href} className={d.featured ? styles.btnFeatured : styles.btn}>
                {cta}
              </Link>
            ) : (
              <button
                type="button"
                className={d.featured ? styles.btnFeatured : styles.btn}
                onClick={() => onChoose?.(plan.id)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.id ? "Opening payment…" : cta}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
