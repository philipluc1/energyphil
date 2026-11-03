import { billDetail, type PlanRow, type UsageInput } from "@/lib/plans";
import s from "./priceaddsup.module.css";

// "How it adds up" (3 Nov 2026, Phil: customers only look at the dollars).
// The plan's price in plain dollars, so a lower rate on a dearer plan makes
// sense: being connected + the power you use - discounts = the price shown.

const money = (n: number) => `$${Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const c2 = (n: number) => Math.round(n * 100) / 100;

export default function PriceAddsUp({ plan, usage, scale = 1, periodLabel }: { plan: PlanRow; usage: UsageInput; scale?: number; periodLabel: string }) {
  const d = billDetail(plan, usage);
  if (!d) return null;
  const lines: { label: string; v: number; minus?: boolean }[] = [
    { label: "To be connected", v: c2(d.supply * scale) },
    { label: "The power you use", v: c2((d.usage + d.demand) * scale) },
  ];
  if (d.solarCredit > 0.005) lines.push({ label: "Back for your solar", v: c2(d.solarCredit * scale), minus: true });
  if (d.discount > 0.005) lines.push({ label: d.conditionalDiscount > 0.005 ? "Discount for paying on time" : "Discount", v: c2(d.discount * scale), minus: true });
  // Each line rounded to the cent, and the total is their sum, so it always adds up.
  const total = c2(lines.reduce((a, l) => a + (l.minus ? -l.v : l.v), 0));
  return (
    <div className={s.box}>
      <span className={s.head}>How {money(total)} {periodLabel} adds up</span>
      <ul className={s.list}>
        {lines.map((l) => (
          <li key={l.label} className={l.minus ? s.minus : undefined}>
            <span>{l.label}</span>
            <b>{l.minus ? "−" : ""}{money(l.v)}</b>
          </li>
        ))}
        <li className={s.total}><span>You pay</span><b>{total < 0 ? "−" : ""}{money(total)}</b></li>
      </ul>
    </div>
  );
}
