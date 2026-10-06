import styles from "../home.module.css";

/** The journey of a price: retailer feed → Utilo → your result. Animated once, on reveal. */
export default function PriceFlow() {
  const stops = [
    { k: "Retailers", d: "publish every plan and rate in a public data feed" },
    { k: "Utilo", d: "reads the feeds and prices each plan for your home" },
    { k: "You", d: "see one number and the plan behind it" },
  ];
  return (
    <div className={styles.flow} aria-hidden="false">
      <svg className={styles.flowSvg} viewBox="0 0 900 120" role="img" aria-label="Prices flow from retailers, through Utilo, to you">
        <defs>
          <linearGradient id="fl" gradientUnits="userSpaceOnUse" x1="90" y1="60" x2="810" y2="60">
            <stop offset="0" stopColor="#0ea5a0" />
            <stop offset="1" stopColor="#f5a623" />
          </linearGradient>
        </defs>
        <path className={styles.flowTrack} d="M90 60 H810" />
        <path className={styles.flowLine} d="M90 60 H810" stroke="url(#fl)" />
        <circle className={styles.flowDot} r="7" fill="#f5a623">
          <animateMotion dur="3.2s" repeatCount="indefinite" path="M90 60 H810" />
        </circle>
        {[90, 450, 810].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="60" r="26" className={styles.flowNode} />
            <text x={x} y="66" textAnchor="middle" className={styles.flowNum}>{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className={styles.flowLabels}>
        {stops.map((s) => (
          <div key={s.k}>
            <b>{s.k}</b>
            <span>{s.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
