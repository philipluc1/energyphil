import type { ReactNode } from "react";
import Icon from "./Icon";
import { PLUS_NAME } from "@/lib/pricingPlans";
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
    <>
    <section id={id} className={styles.band} data-motion="" data-stagger=":scope > div, :scope > ul > li, :scope > p">
      <div className={styles.head}>
        <span className={styles.eyebrow}><Icon name="bolt" size={14} /> {PLUS_NAME}</span>
        {/* Each sentence on its own line ("We keep checking." / "Every day."), so a short one never dangles. */}
        <h2>{title.split(/(?<=\.)\s+(?=\S)/).map((part, i) => <span key={i} className={styles.titleLine}>{part}</span>)}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {/* What you get: the hero of the band. */}
      {gets && <ul className={styles.gets}>
        {/* 12 Nov 2026 (Phil): the "As a Utilo Plus member, you get…" row folded in here: a title and one short line each. */}
        <li><span className={`${styles.getIcon} ${styles.gBolt}`}><Icon name="bolt" size={20} /></span><b>Instant answers</b><span>Snap your bill, see your saving.</span></li>
        <li><span className={`${styles.getIcon} ${styles.gDollar}`}><Icon name="dollar" size={20} /></span><b>Every plan checked, every day</b><span>Priced on your own bill, in dollars.</span></li>
        <li><span className={`${styles.getIcon} ${styles.gCheck}`}><Icon name="check" size={20} /></span><b>You stay in control</b><span>We prompt. You decide. Only emails that pay.</span></li>
        <li><span className={`${styles.getIcon} ${styles.gHome}`}><Icon name="home" size={20} /></span><b>One membership, every bill</b><span>Power and gas, one price.</span></li>
      </ul>}
      {children && <div className={styles.step}>{children}</div>}
      <div className={styles.cards}>{cards}</div>
    </section>
    {/* Trust badges sit under the band, on their own (1 Nov 2026). */}
      <ul className={styles.trust} aria-label="Why people trust Utilo">
        <li><span className={styles.shield} aria-hidden="true"><Icon name="scale" size={20} /></span><span><small>Independent</small><b>$0 from retailers</b></span></li>
        <li><span className={styles.shield} aria-hidden="true"><Icon name="check" size={20} /></span><span><small>No lock-in</small><b>Cancel any time</b></span></li>
        <li><span className={styles.shield} aria-hidden="true"><Icon name="lock" size={20} /></span><span><small>Private</small><b>Numbers, not your bill</b></span></li>
        <li><span className={styles.shield} aria-hidden="true"><Icon name="home" size={20} /></span><span><small>Proudly Australian</small><b>Homes now, business soon</b></span></li>
      </ul>
    </>
  );
}
