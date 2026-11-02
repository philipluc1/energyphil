import Link from "next/link";
import { FOUNDING_OFFER, PLANS_ON_SALE, SPECIAL_ENDS_SHORT, SPECIAL_NAME, fmtPrice, plusValue, regularPrice, type PlanId } from "@/lib/pricingPlans";
import styles from "./plancards.module.css";

/**
 * Utilo Plus (2 Nov 2026): yearly is the offer, shown large, with the
 * founding price and what it costs a week; month to month sits underneath,
 * smaller. Pass `onChoose` to start checkout, or `href` to link the buttons.
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
  const annual = PLANS_ON_SALE.find((p) => p.id === "annual");
  const monthly = PLANS_ON_SALE.find((p) => p.id === "monthly");
  const action = (id: PlanId, label: string, cls: string) =>
    href ? (
      <Link href={href} className={cls}>{label}</Link>
    ) : (
      <button type="button" className={cls} onClick={() => onChoose?.(id)} disabled={loadingPlan !== null}>
        {loadingPlan === id ? "Opening payment…" : label}
      </button>
    );
  return (
    <div className={`${styles.stack} ${dark ? styles.dark : ""}`}>
      {annual && (
        <div className={`${styles.card} ${styles.featured} ${styles.hero}`}>
          <span className={styles.ribbon}>{FOUNDING_OFFER ? `${SPECIAL_NAME} · until ${SPECIAL_ENDS_SHORT}` : `Best value · save ${v.save}`}</span>
          <div className={styles.name}>Yearly</div>
          <div className={styles.priceRow}>
            {/* Founding offer (2 Nov 2026): the regular price struck through; otherwise monthly × 12. */}
            <span className={styles.anchor}>{regularPrice("annual") ? fmtPrice(regularPrice("annual")!) : v.monthlyYear}</span>
            <span className={styles.price}>{fmtPrice(annual.priceCents)}</span>
            <span className={styles.per}>/ year</span>
          </div>
          <div className={styles.week}>That&apos;s <b>{v.perWeek} a week</b>. {v.save} less than paying monthly.</div>
          <div className={styles.small}>{FOUNDING_OFFER ? "Locked in while you stay · cancel any time" : "One payment a year · cancel any time"}</div>
          {action(annual.id, cta, styles.btnFeatured)}
        </div>
      )}
      {monthly && (
        <div className={styles.monthly}>
          <span>Or {regularPrice("monthly") ? <s className={styles.monthlyWas}>{fmtPrice(regularPrice("monthly")!)}</s> : null} <b>{fmtPrice(monthly.priceCents)}</b> month to month <span className={styles.monthlyNote}>({v.monthlyYear} a year)</span></span>
          {action(monthly.id, href ? "Monthly" : "Choose monthly", styles.btnSmall)}
        </div>
      )}
    </div>
  );
}
