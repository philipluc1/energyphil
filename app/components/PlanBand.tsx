import type { ReactNode } from "react";
import ScrollReveal from "./ScrollReveal";
import styles from "./planband.module.css";

/** The membership pitch: a dark band with one headline, three proofs, the
 *  plan cards, and a trust line. Used on results, home and pricing. */
export default function PlanBand({
  title,
  intro,
  children,
  cards,
  id = "pricing",
}: {
  title: string;
  intro: ReactNode;
  /** Optional step before the cards (the email field on results). */
  children?: ReactNode;
  cards: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={styles.band}>
      <div className={styles.orbA} aria-hidden="true" />
      <div className={styles.orbB} aria-hidden="true" />
      <ScrollReveal className={styles.head}>
        <span className={styles.eyebrow}>Membership</span>
        <h2>{title}</h2>
        <p>{intro}</p>
      </ScrollReveal>
      <ScrollReveal delayMs={120} className={styles.proofs}>
        <div className={styles.proof}><span className={styles.proofNum}>Every morning</span><span>every plan we track on your network, priced against yours</span></div>
        <div className={styles.proof}><span className={styles.proofNum}>One email</span><span>only when switching is worth at least $50 a year</span></div>
        <div className={styles.proof}><span className={styles.proofNum}>Every month</span><span>a bill read and a saved result on your dashboard</span></div>
      </ScrollReveal>
      {children && <ScrollReveal delayMs={200} className={styles.step}>{children}</ScrollReveal>}
      <div className={styles.cards}>{cards}</div>
      <p className={styles.trust}>Not a cent from retailers · Cancel any time · Electricity and gas · Victorian data, checked daily</p>
    </section>
  );
}
