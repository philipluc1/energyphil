import { activityWords, marketActivity } from "@/lib/marketActivity";
import Icon from "./Icon";
import s from "./marketpulse.module.css";

/**
 * "Offers keep changing" with proof. Once the daily pull has dated offers:
 * the real count of new offers and price changes in the last 30 days. Before
 * that (starter data): two published findings on how fast prices move.
 */
export default function MarketPulse({ network, compact = false }: { network?: string | null; compact?: boolean }) {
  const a = marketActivity({ days: 30, network });
  const where = network ? `on the ${network} network` : "across Victoria";
  if (a.ready && a.newOffers + a.priceChanges > 0) {
    return (
      <p className={`${s.pulse} ${compact ? s.compact : ""}`}>
        <span className={s.dot} aria-hidden="true" />
        <span>
          <b>In the last 30 days: {activityWords(a)}</b> {where}, from {a.retailers} {a.retailers === 1 ? "retailer" : "retailers"}. We checked every one.
        </span>
      </p>
    );
  }
  return (
    <p className={`${s.pulse} ${s.facts} ${compact ? s.compact : ""}`}>
      <span className={s.icon} aria-hidden="true"><Icon name="refresh" size={16} /></span>
      <span>
        Retailers often raise introductory prices by 20% or more within a year (Australian Energy Market Commission), and offers more than a
        year old cost households about $238 a year more (ACCC).
      </span>
    </p>
  );
}
