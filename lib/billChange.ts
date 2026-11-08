// "Why did my bill change?" (2 Nov 2026): the latest bill against the one
// before, in plain words. A bill moves for three reasons: it covered more or
// fewer days, you used more or less each day, or each unit cost more or less
// (counting the supply charge). We say which mattered, and by roughly how much.

import type { BillDetail } from "./billTracker";

export interface BillPoint {
  periodEnd: string;
  days: number;
  amount: number;
  /** kWh or MJ for the period. */
  usage: number;
  /** 8 Nov 2026: supply, credits, fees and read type, when the bill was read from a photo. */
  detail?: BillDetail | null;
}

export interface BillChange {
  diff: number;
  /** "$62 more than your last bill" */
  headline: string;
  /** The reasons, biggest first, e.g. ["9 more days", "18% more power a day"]. */
  reasons: string[];
  /** The one that moved the bill most. */
  main: "days" | "usage" | "price" | null;
}

const whole = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("en-AU");
const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

export function billChange(prev: BillPoint, next: BillPoint, unit: "power" | "gas" = "power"): BillChange | null {
  if (![prev, next].every((b) => b.days > 0 && b.amount > 0 && b.usage > 0)) return null;
  const diff = next.amount - prev.amount;
  if (Math.abs(diff) < 5) return { diff, headline: "About the same as your last bill", reasons: [], main: null };

  const u0 = prev.usage / prev.days, u1 = next.usage / next.days;
  const p0 = prev.amount / prev.usage, p1 = next.amount / next.usage;
  // Each effect in dollars, so the biggest can be named.
  const daysFx = (prev.amount / prev.days) * (next.days - prev.days);
  const usageFx = (u1 - u0) * next.days * p0;
  const priceFx = diff - daysFx - usageFx;

  const word = unit === "gas" ? "gas" : "power";
  const parts: { key: BillChange["main"]; fx: number; text: string }[] = [];
  const dd = next.days - prev.days;
  if (Math.abs(dd) >= 3) parts.push({ key: "days", fx: daysFx, text: `${Math.abs(dd)} ${dd > 0 ? "more" : "fewer"} days` });
  const du = u1 / u0 - 1;
  if (Math.abs(du) >= 0.05) parts.push({ key: "usage", fx: usageFx, text: `${pct(du)} ${du > 0 ? "more" : "less"} ${word} a day` });
  const dp = p1 / p0 - 1;
  if (Math.abs(dp) >= 0.03) parts.push({ key: "price", fx: priceFx, text: `each ${unit === "gas" ? "MJ" : "kWh"} cost ${pct(dp)} ${dp > 0 ? "more" : "less"}, counting supply` });
  parts.sort((a, b) => Math.abs(b.fx) - Math.abs(a.fx));
  // The main reason has to push the same way as the bill moved.
  const main = parts.find((x) => Math.sign(x.fx) === Math.sign(diff))?.key ?? null;
  return { diff, headline: `${whole(diff)} ${diff > 0 ? "more" : "less"} than your last bill`, reasons: parts.map((x) => x.text), main };
}

/** The latest two bills, in period order, that can be compared. */
export function latestPair<T extends { period_end: string; billing_days: number; amount: number | null; detail?: BillDetail | null }>(bills: T[], usageOf: (b: T) => number | null): [BillPoint, BillPoint] | null {
  const ok = bills
    .filter((b) => b.amount !== null && b.amount > 0 && (usageOf(b) ?? 0) > 0 && b.billing_days > 0)
    .sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
  if (ok.length < 2) return null;
  const pt = (b: T): BillPoint => ({ periodEnd: b.period_end, days: b.billing_days, amount: b.amount as number, usage: usageOf(b) as number, detail: b.detail ?? null });
  return [pt(ok[ok.length - 2]), pt(ok[ok.length - 1])];
}

// --- "Why this bill went up" (8 Nov 2026) ---------------------------------
// The same idea with a dollar figure on every reason, so it can be drawn as
// bars and said in one line: "$63 more: $41 from using more, $22 from prices".
// With the bill's detail we also separate the concession, fees and the supply
// charge, and add what the bill itself can't say: an estimated read, a rebate
// that's gone, a tariff that changed. The steps always add up to the change.

export type StepKey = "days" | "usage" | "price" | "concession" | "fees";
export interface BillStep {
  key: StepKey;
  /** "Used 18% more power a day" */
  label: string;
  /** + made the bill bigger, - smaller. */
  dollars: number;
}
export interface BillExplanation {
  diff: number;
  /** "$63 more than your last bill" */
  headline: string;
  /** "$41 from using more power and $22 from higher prices." */
  sentence: string;
  /** Biggest first; the small ones (under $3) left out. */
  steps: BillStep[];
  /** Things worth knowing that aren't dollars in the change: estimated reads, rebates, tariff and supply changes. */
  notes: string[];
  prevEnd: string;
  nextEnd: string;
  prevAmount: number;
  nextAmount: number;
}

const cents = (n: number) => (n < 1 ? `${Math.round(n * 100)}c` : `$${n.toFixed(2)}`);
const MIN_STEP = 3;

export function explainBill(prev: BillPoint, next: BillPoint, unit: "power" | "gas" = "power"): BillExplanation | null {
  if (![prev, next].every((b) => b.days > 0 && b.amount > 0 && b.usage > 0)) return null;
  const d0 = prev.detail ?? null, d1 = next.detail ?? null;
  const conc0 = d0?.concession ?? 0, conc1 = d1?.concession ?? 0;
  const fee0 = d0?.fees ?? 0, fee1 = d1?.fees ?? 0;
  // What the plan's prices made, before the concession came off and without fees.
  let g0 = prev.amount + conc0 - fee0, g1 = next.amount + conc1 - fee1;
  let concFx = conc0 - conc1, feeFx = fee1 - fee0;
  if (g0 <= 0 || g1 <= 0) { g0 = prev.amount; g1 = next.amount; concFx = 0; feeFx = 0; }
  const diff = next.amount - prev.amount;

  const u0 = prev.usage / prev.days, u1 = next.usage / next.days;
  // With the supply charge known, usage is priced on the usage part alone (supply doesn't grow with use).
  const s0 = d0?.supply && d0.supply * prev.days < g0 ? d0.supply : 0;
  const p0 = (g0 - s0 * prev.days) / prev.usage;
  const dd = next.days - prev.days;
  const daysFx = s0 * dd + u0 * dd * p0;
  const usageFx = (u1 - u0) * next.days * p0;
  const priceFx = g1 - g0 - daysFx - usageFx;

  const word = unit === "gas" ? "gas" : "power";
  const du = u1 / u0 - 1;
  const all: BillStep[] = [
    { key: "days", dollars: daysFx, label: `${Math.abs(dd)} ${dd > 0 ? "more" : "fewer"} day${Math.abs(dd) === 1 ? "" : "s"} on this bill` },
    { key: "usage", dollars: usageFx, label: `Used ${Math.round(Math.abs(du) * 100)}% ${du > 0 ? "more" : "less"} ${word} a day` },
    { key: "price", dollars: priceFx, label: priceFx > 0 ? "Higher prices" : "Lower prices" },
    { key: "concession", dollars: concFx, label: conc1 === 0 && conc0 > 0 ? "Concession not on this bill" : conc1 > conc0 ? (conc0 === 0 ? "Concession added" : "Bigger concession") : "Smaller concession" },
    { key: "fees", dollars: feeFx, label: feeFx > 0 ? "Fees" : "Fewer fees" },
  ];
  const steps = all.filter((x) => Math.abs(x.dollars) >= MIN_STEP).sort((a, b) => Math.abs(b.dollars) - Math.abs(a.dollars));

  const phrase = (x: BillStep) => {
    const m = whole(x.dollars);
    switch (x.key) {
      case "days": return `${m} from ${Math.abs(dd)} ${dd > 0 ? "more" : "fewer"} day${Math.abs(dd) === 1 ? "" : "s"}`;
      case "usage": return `${m} from using ${x.dollars > 0 ? "more" : "less"} ${word}`;
      case "price": return `${m} from ${x.dollars > 0 ? "higher" : "lower"} prices`;
      case "concession": return x.dollars > 0 ? `${m} because ${conc1 === 0 ? "the concession isn't on it" : "the concession was smaller"}` : `${m} from the concession`;
      case "fees": return x.dollars > 0 ? `${m} in fees` : `${m} fewer fees`;
    }
  };
  const small = Math.abs(diff) < 5;
  const headline = small ? "About the same as your last bill" : `${whole(diff)} ${diff > 0 ? "more" : "less"} than your last bill`;
  // Lead with what pushed the bill the way it went; mention one push the other way.
  const withDir = steps.filter((x) => Math.sign(x.dollars) === Math.sign(diff || 1));
  const against = steps.filter((x) => Math.sign(x.dollars) !== Math.sign(diff || 1));
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const lead = withDir.slice(0, 3).map(phrase);
  const sentence = small || !lead.length
    ? steps.length >= 2 ? `${list(steps.slice(0, 2).map(phrase))}, which roughly cancel out.` : "Nothing much changed."
    : `${list(lead).replace(/^./, (c) => c.toUpperCase())}${against[0] ? `, partly offset by ${phrase(against[0])}` : ""}.`;

  const notes: string[] = [];
  if (d1?.estimated) notes.push(`This bill used an estimated meter read, so the next one may go up or down to correct it.`);
  else if (d0?.estimated) notes.push(`Your last bill used an estimated read and this one is an actual read, so part of the change may be a catch-up.`);
  const r0 = d0?.rebate ?? 0, r1 = d1?.rebate ?? 0;
  if (r0 >= 1 && r1 < r0 - 1) notes.push(`Your last bill also had ${whole(r0)} in government rebates taken off what you paid${r1 >= 1 ? `; this one has ${whole(r1)}` : "; this one has none"}.`);
  else if (r1 >= 1 && r1 > r0 + 1) notes.push(`This bill has ${whole(r1)} in government rebates taken off what you pay.`);
  if (d0?.tariff && d1?.tariff && d0.tariff.toLowerCase() !== d1.tariff.toLowerCase()) notes.push(`Your tariff changed, from ${d0.tariff} to ${d1.tariff}.`);
  if (d0?.supply && d1?.supply && Math.abs(d1.supply / d0.supply - 1) >= 0.02) notes.push(`The supply charge went from ${cents(d0.supply)} to ${cents(d1.supply)} a day.`);

  return { diff, headline, sentence, steps, notes, prevEnd: prev.periodEnd, nextEnd: next.periodEnd, prevAmount: prev.amount, nextAmount: next.amount };
}
