import type { ReactNode } from "react";
import Icon from "./Icon";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import styles from "./planband.module.css";

/** The Utilo Plus pitch: one flat navy band with a headline, what you get
 *  (four tiles), the plan cards, and three trust badges. Used on results, home and pricing. */
export default function PlanBand({
  title,
  intro,
  children,
  cards,
  id = "pricing",
  gets = true,
}: {
  /** Show the four "what you get" tiles (off where a table above already says it). */
  gets?: boolean;
  title: string;
  /** One short line. Longer explanations belong in an InfoTip. */
  intro?: ReactNode;
  /** Optional step before the cards (the email field on results). */
  children?: ReactNode;
  cards: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={styles.band} data-motion="" data-stagger=":scope > div, :scope > ul > li, :scope > p">
      <div className={styles.head}>
        <span className={styles.eyebrow}><Icon name="bolt" size={14} /> {PLUS_NAME}</span>
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {/* What you get: the hero of the band. */}
      {gets && <ul className={styles.gets}>
        <li><span className={styles.getIcon}><Icon name="refresh" size={20} /></span><b>Every plan, every morning</b><span>Re-priced against your own bill.</span></li>
        <li><span className={styles.getIcon}><Icon name="bell" size={20} /></span><b>A month&apos;s warning</b><span>Before your discount ends and prices jump.</span></li>
        <li><span className={styles.getIcon}><Icon name="mail" size={20} /></span><b>Only emails that pay</b><span>When switching saves ${WORTH_SWITCHING_PER_YEAR}+ a year.</span></li>
        <li><span className={styles.getIcon}><Icon name="chart" size={20} /></span><b>Your bills, tracked</b><span>Power and gas, month by month.</span></li>
      </ul>}
      {children && <div className={styles.step}>{children}</div>}
      <div className={styles.cards}>{cards}</div>
      <ul className={styles.badges} aria-label="Why people trust Utilo">
        <li><span className={styles.badgeIcon}><Icon name="scale" size={18} /></span><b>Independent</b><span>Not a cent from retailers</span></li>
        <li><span className={styles.badgeIcon}><Icon name="check" size={18} /></span><b>No lock-in</b><span>Cancel any time, no fees</span></li>
        <li><span className={styles.badgeIcon}><Icon name="lock" size={18} /></span><b>Private</b><span>We keep the numbers, not your bill</span></li>
      </ul>
    </section>
  );
}
