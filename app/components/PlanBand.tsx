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
    <>
    <section id={id} className={styles.band} data-motion="" data-stagger=":scope > div, :scope > ul > li, :scope > p">
      <div className={styles.head}>
        <span className={styles.eyebrow}><Icon name="bolt" size={14} /> {PLUS_NAME}</span>
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {/* What you get: the hero of the band. */}
      {gets && <ul className={styles.gets}>
        <li><span className={styles.getIcon}><Icon name="bell" size={20} /></span><b>Never miss a price jump</b><span>A month&apos;s warning before your discount or fixed price ends.</span></li>
        <li><span className={styles.getIcon}><Icon name="refresh" size={20} /></span><b>Know the day it&apos;s cheaper</b><span>Every plan re-checked against your own bill, each morning.</span></li>
        <li><span className={styles.getIcon}><Icon name="mail" size={20} /></span><b>Only emails that pay</b><span>One email, when switching saves ${WORTH_SWITCHING_PER_YEAR}+ a year.</span></li>
        <li><span className={styles.getIcon}><Icon name="home" size={20} /></span><b>One membership, every bill</b><span>Power and gas now, more to come. Tracked in one place.</span></li>
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
