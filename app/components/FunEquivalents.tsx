import styles from "./fun.module.css";

// Rough, round prices so the comparison is easy to picture. Not exact.
const ITEMS = [
  { emoji: "☕", one: "coffee", many: "coffees", price: 5 },
  { emoji: "🍕", one: "pizza night", many: "pizza nights", price: 30 },
  { emoji: "🎬", one: "cinema trip for two", many: "cinema trips for two", price: 50 },
  { emoji: "⛽", one: "tank of petrol", many: "tanks of petrol", price: 100 },
  { emoji: "✈️", one: "weekend away", many: "weekends away", price: 500 },
];

/** A few friendly "that's about…" comparisons for a yearly saving. */
export default function FunEquivalents({ dollars, dark = false }: { dollars: number; dark?: boolean }) {
  if (!(dollars >= 5)) return null;
  const picks = ITEMS.map((it) => ({ ...it, n: Math.floor(dollars / it.price) })).filter((it) => it.n >= 1);
  // Always lead with coffees, then the two biggest-feeling items that still count 1+.
  const shown = [picks[0], ...picks.slice(1).slice(-2)].filter(Boolean);
  return (
    <div className={`${styles.wrap} ${dark ? styles.dark : ""}`} aria-label="What that saving is worth">
      <div className={styles.lead}>That&apos;s about</div>
      <div className={styles.row}>
        {shown.map((it, i) => (
          <div key={it.one} className={styles.chip} style={{ animationDelay: `${i * 120}ms` }}>
            <span className={styles.emoji} aria-hidden="true">{it.emoji}</span>
            <b>{it.n.toLocaleString("en-AU")}</b> {it.n === 1 ? it.one : it.many}
          </div>
        ))}
      </div>
    </div>
  );
}
