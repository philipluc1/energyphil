import type { ReactNode } from "react";
import Icon from "./Icon";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { WORTH_SWITCHING_PER_YEAR } from "@/lib/dataPolicy";
import styles from "./planband.module.css";

/** The Utilo Plus pitch: one flat navy band with a headline, three short
 *  promises, the plan cards, and a trust line. Used on results, home and pricing. */
export default function PlanBand({
  title,
  intro,
  children,
  cards,
  id = "pricing",
}: {
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
      <ul className={styles.proofs}>
        <li><Icon name="refresh" size={18} /> We check every plan for you, every morning</li>
        <li><Icon name="mail" size={18} /> One email, only when switching saves ${WORTH_SWITCHING_PER_YEAR}+</li>
        <li><Icon name="bell" size={18} /> A heads-up before your discount ends</li>
      </ul>
      {children && <div className={styles.step}>{children}</div>}
      <div className={styles.cards}>{cards}</div>
      <p className={styles.trust}>Not a cent from retailers · Cancel any time · Electricity and gas</p>
    </section>
  );
}
