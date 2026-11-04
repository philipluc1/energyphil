import { offerDates } from "@/lib/planTerms";
import s from "./offerdate.module.css";

/** "Offer from 3 Oct 2026", plus a "New offer" or "Offer updated" badge when recent. */
export default function OfferDate({ retailer, plan, dark = false, badgeOnly = false, short = false, noDate = false, recentDays }: {
  retailer: string;
  plan: string;
  dark?: boolean;
  /** Only the "New" / "Updated" badge, and only when recent (the compact plan list). */
  badgeOnly?: boolean;
  /** With badgeOnly: a small bubble, "New" or "Updated 3 Nov" (no year; full date on hover). */
  short?: boolean;
  /** With short: leave the date off ("Updated" only), for narrow phone rows. */
  noDate?: boolean;
  recentDays?: number;
}) {
  const d = offerDates(retailer, plan, undefined, recentDays);
  if (badgeOnly) {
    if (!d.badge) return null;
    return (
      <span className={`${s.wrap} ${dark ? s.dark : ""}`}>
        <span className={`${d.badge === "New" ? s.new : s.changed} ${short ? s.bubble : ""}`} title={short ? `${d.badge === "New" ? "New offer" : "Offer updated"}${d.badgeDate ? ` ${d.badgeDate}` : ""}` : d.label ?? undefined}>
          {d.badge === "New" ? "New" : "Updated"}{d.badgeDate && !(short && (noDate || d.badge === "New")) ? ` ${short ? d.badgeDate.replace(/\s\d{4}$/, "") : d.badgeDate}` : ""}
        </span>
      </span>
    );
  }
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
