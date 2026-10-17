import { offerDates } from "@/lib/planTerms";
import s from "./offerdate.module.css";

/** "Offer from 3 Oct 2026", plus a "New" or "Price change" badge when recent. */
export default function OfferDate({ retailer, plan, dark = false }: { retailer: string; plan: string; dark?: boolean }) {
  const d = offerDates(retailer, plan);
  if (!d.label && !d.badge) return null;
  return (
    <span className={`${s.wrap} ${dark ? s.dark : ""}`}>
      {d.badge && (
        <span className={d.badge === "New" ? s.new : s.changed} title={d.badgeDate ? `${d.badge}: ${d.badgeDate}` : undefined}>
          {d.badge === "New" ? "New offer" : "Prices changed"}{d.badgeDate ? ` ${d.badgeDate}` : ""}
        </span>
      )}
      {d.label && <span className={s.label}>{d.label}</span>}
    </span>
  );
}
