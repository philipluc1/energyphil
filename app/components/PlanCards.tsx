import Link from "next/link";
import { FOUNDING_OFFER, PLANS_ON_SALE, fmtPrice, plusValue, regularFromLine, regularPrice, type PlanId } from "@/lib/pricingPlans";
import styles from "./plancards.module.css";

/**
 * Utilo Plus: one price, yearly (12 Nov 2026, Phil: monthly and the sale
 * bubble removed). The regular price struck through while the founding price
 * runs, with the date it applies from in the small print. Pass `onChoose` to start checkout, or `href` to link the buttons.
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
          <div className={styles.name}>{FOUNDING_OFFER ? "Founding price" : "One price"}</div>
          <div className={styles.priceRow}>
            {regularPrice("annual") ? <span className={styles.anchor}>{fmtPrice(regularPrice("annual")!)}</span> : null}
            <span className={styles.price}>{fmtPrice(annual.priceCents)}</span>
            <span className={styles.per}>/ year</span>
          </div>
          <div className={styles.week}>That&apos;s <b>{v.perWeek} a week</b>, for your power and gas.</div>
          <div className={styles.small}>{FOUNDING_OFFER ? "Locked in while you stay · cancel any time" : "One payment a year · cancel any time"}</div>
          {regularFromLine() && <div className={styles.fine}>{regularFromLine()}</div>}
          {action(annual.id, cta, styles.btnFeatured)}
        </div>
      )}
    </div>
  );
}
