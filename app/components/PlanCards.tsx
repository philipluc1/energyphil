import Link from "next/link";
import { PLAN_DISPLAY, PRICING_PLANS, fmtPrice, savePct, type PlanId } from "@/lib/pricingPlans";
import Tag from "./Tag";
import styles from "./plancards.module.css";
import ScrollReveal from "./ScrollReveal";

/** The four membership plans. Pass `onChoose` to make the buttons start checkout
 * (results page), or `href` to link them somewhere (pricing page). */
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
  return (
    <div className={`${styles.grid} ${dark ? styles.dark : ""}`}>
      {PRICING_PLANS.map((plan, i) => {
        const d = PLAN_DISPLAY[plan.id];
        const save = savePct(plan);
        const recurring = plan.mode === "subscription";
        return (
          <ScrollReveal key={plan.id} delayMs={i * 90} className={`${styles.card} ${d.featured ? styles.featured : ""}`}>
            <div className={styles.tagRow}>
              {d.tag && (
                <Tag tone={d.tag.tone} shine={d.featured || d.tag.tone === "green"}>
                  {d.tag.label}
                </Tag>
              )}
            </div>
            <div className={styles.name}>{plan.name}</div>

            <div className={styles.priceRow}>
              {d.anchorCents && <span className={styles.anchor}>{fmtPrice(d.anchorCents)}</span>}
              <span className={styles.price}>{fmtPrice(plan.priceCents)}</span>
            </div>
            <div className={styles.cadence}>
              {recurring ? plan.cadenceLabel : "one payment, once"}
              {save ? <span className={styles.save}>Save {save}%</span> : null}
            </div>
            {d.perMonthCents && plan.id !== "monthly" ? (
              <div className={styles.perMonth}>
                Just <strong>{fmtPrice(d.perMonthCents)}</strong> a month
              </div>
            ) : (
              <div className={styles.perMonth}>{plan.id === "once_off" ? "Under 9 months of Monthly" : "Pay month to month"}</div>
            )}

            <ul className={styles.features}>
              {d.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

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
                {loadingPlan === plan.id ? "Redirecting…" : cta}
              </button>
            )}
          </ScrollReveal>
        );
      })}
    </div>
  );
}
