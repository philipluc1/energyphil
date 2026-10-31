import { offerDates } from "@/lib/planTerms";
import s from "./offerdate.module.css";

/** "Offer from 3 Oct 2026", plus a "New offer" or "Offer updated" badge when recent. */
export default function OfferDate({ retailer, plan, dark = false }: { retailer: string; plan: string; dark?: boolean }) {
  const d = offerDates(retailer, plan);
  if (!d.label && !d.badge) return null;
  return (
    <span className={`${s.wrap} ${dark ? s.dark : ""}`}>
      {d.badge && (
        <span className={d.badge === "New" ? s.new : s.changed} title={d.badgeDate ? `${d.badge}: ${d.badgeDate}` : undefined}>
          {d.badge === "New" ? "New offer" : "Offer updated"}{d.badgeDate ? ` ${d.badgeDate}` : ""}
        </span>
      )}
      {/* "New offer 30 Sept" already says when it started: don't repeat it as "Offer from 30 Sept". */}
      {d.label && !(d.badge === "New" && d.badgeDate && d.label.includes(d.badgeDate)) && <span className={s.label}>{d.label}</span>}
    </span>
  );
}
