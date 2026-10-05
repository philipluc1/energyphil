import styles from "./EnergyTips.module.css";

// Written energy-saving guidance for the account portal. Phil asked for
// "vlogs" on saving energy — we can't produce real video here, so this is
// the written substitute: short, practical, general advice rather than
// household-specific claims we can't actually back with this customer's
// data. Kept deliberately general (no invented savings percentages) so
// nothing here could be read as a guarantee.
export interface EnergyTip {
  title: string;
  body: string;
}

export const ENERGY_TIPS: EnergyTip[] = [
  { title: "Check your plan each month", body: "The plan itself is usually the biggest saving — upload your latest bill." },
  { title: "Use off-peak hours", body: "Run the dishwasher, washer or EV charger outside the evening peak." },
  { title: "Set heating & cooling sensibly", body: "Around 18–20°C in winter and 25–26°C in summer." },
  { title: "Seal draughts", body: "Door seals and closing off unused rooms cut heating and cooling." },
  { title: "Switch off standby", body: "Turn TVs, consoles and chargers off at the wall." },
  { title: "Full loads, cold wash", body: "Fewer cycles, and no energy spent heating wash water." },
  { title: "Solar? Use it by day", body: "Run appliances in daylight to use your own power first." },
  { title: "LEDs and fridge at 3–4°C", body: "LEDs use a fraction of old bulbs; colder fridges waste power." },
];

function IconLeaf() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4c-9 0-16 6-16 15 9 0 15-7 15-16Z" />
      <path d="M5 19C9 13 13 9 19 5" />
    </svg>
  );
}

export default function EnergyTips() {
  return (
    <details className={styles.tipsBox}>
      <summary className={styles.tipsHead}>
        <span className={styles.tipsIcon}>
          <IconLeaf />
        </span>
        <div>
          <div className={styles.tipsTitle}>Ways to use less energy</div>
          <p className={styles.tipsSub}>8 quick tips</p>
        </div>
      </summary>
      <div className={styles.tipsGrid}>
        {ENERGY_TIPS.map((tip) => (
          <div className={styles.tipCard} key={tip.title}>
            <div className={styles.tipTitle}>{tip.title}</div>
            <p className={styles.tipBody}>{tip.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
