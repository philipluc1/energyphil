// Sign-up credits, points, gift cards and percentage discounts, pulled out of
// each offer's Consumer Data Right extras for the dashboard's "Discounts and
// rewards" section. Retailers publish these as free text, so this sorts them
// into four kinds and reads the dollar or points figure where there is one.
//
// Rules (with Phil, 31 Oct 2026):
//   - Credits, points and gifts are shown, never added to the price.
//   - Percentage discounts we already price (guaranteed, pay on time, direct
//     debit) say so; other conditional ones say they aren't in the price.
//   - Not rewards for the customer, so left out: refer-a-friend, GreenPower,
//     solar feed-in, charity contributions, demand-response rebates,
//     service promises and bank bundles.

import { discountLabel, isLive, isPriced, type PlanDiscount, type PlanExtras, type PlanIncentive } from "./planExtras";

export type RewardKind = "credit" | "points" | "gift" | "discount";

export interface Reward {
  kind: RewardKind;
  /** Short and big: "$200 credit", "10,000 Velocity points", "5% off the bill". */
  headline: string;
  /** The retailer's own words, when they add something (conditions, timing). */
  detail: string | null;
  /** True when the plan's price already includes it. */
  inPrice: boolean;
  /** For sorting within a kind: dollars, points, or percent. */
  value: number;
}

export const REWARD_KIND_LABEL: Record<RewardKind, string> = {
  credit: "Bill credits",
  points: "Points",
  gift: "Gift cards and perks",
  discount: "% off",
};

const SKIP = /refer a friend|referral|refer someone|greenpower|feed-?in|contribution|powerresponse|renewable matching|movers guarantee|call cent(er|re)|solar max|commbank|yello|taronga/i;
const POINTS = /points|velocity|qantas|everyday rewards|flybuys/i;
const CREDIT = /credit|first bill|join and stay/i;
const GIFT = /prepaid|visa|mastercard|voucher|netflix|membership|perks|gift card|e-?gift/i;

const tidy = (t: string) => t.replace(/\s+/g, " ").trim();
const num = (t: string) => Number(t.replace(/,/g, ""));

function dollars(text: string): number | null {
  const m = text.match(/\$\s?(\d[\d,]*)/);
  return m ? num(m[1]) : null;
}

function detailOf(i: PlanIncentive): string | null {
  const d = i.description ? tidy(i.description) : "";
  if (!d || d.toLowerCase() === tidy(i.name).toLowerCase()) return null;
  return d.length > 160 ? `${d.slice(0, 157).replace(/\s+\S*$/, "")}…` : d;
}

/** One incentive as a reward, or null when it isn't one for the customer. */
export function rewardFromIncentive(i: PlanIncentive): Reward | null {
  const name = tidy(i.name);
  const all = `${name} ${i.description ?? ""}`;
  if (SKIP.test(name)) return null;
  const detail = detailOf(i);
  if (POINTS.test(name)) {
    const brand = /qantas/i.test(all) ? "Qantas" : /velocity/i.test(all) ? "Velocity" : /everyday rewards/i.test(all) ? "Everyday Rewards" : /flybuys/i.test(all) ? "Flybuys" : "";
    // "5,000 Velocity Points" in the name, else the first big figure before "points" in the description.
    const m = name.match(/(\d[\d,]{2,})/) ?? (i.description ?? "").match(/(\d[\d,]{2,})\s+(?:bonus\s+)?(?:\w+\s+)?points/i);
    const n = m ? num(m[1]) : 0;
    return { kind: "points", headline: tidy(`${n ? `${n.toLocaleString("en-AU")} ` : ""}${brand} points`), detail, inPrice: false, value: n };
  }
  if (CREDIT.test(name) || (i.category === "ACCOUNT_CREDIT" && !GIFT.test(name))) {
    const d = dollars(name) ?? dollars(i.description ?? "");
    return { kind: "credit", headline: d ? `$${d.toLocaleString("en-AU")} credit` : "Account credit", detail, inPrice: false, value: d ?? 0 };
  }
  if (i.category === "GIFT" || GIFT.test(name)) {
    const d = dollars(name) ?? 0;
    return { kind: "gift", headline: name.replace(/^(bonus|engie)\s+/i, "").replace(/^(.)/, (c) => c.toUpperCase()), detail, inPrice: false, value: d };
  }
  return null;
}

/** A percentage or dollar discount that's still on offer. */
export function rewardFromDiscount(d: PlanDiscount): Reward | null {
  if (!isLive(d)) return null;
  // A fixed-dollar "discount" is nearly always a one-off sign-up credit
  // (Powershop's $200, Flow Power's $150). Referral ones aren't for you.
  if (d.method === "fixedAmount" && d.amount !== null) {
    if (SKIP.test(`${d.name} ${d.description ?? ""}`)) return null;
    const text = d.description ? tidy(d.description) : null;
    return { kind: "credit", headline: `$${Math.round(d.amount).toLocaleString("en-AU")} credit`, detail: text && text.length > 160 ? `${text.slice(0, 157).replace(/\s+\S*$/, "")}…` : text, inPrice: false, value: d.amount };
  }
  const pct = d.rate !== null ? d.rate * 100 : 0;
  if (!pct && d.amount === null) return null;
  const priced = isPriced(d);
  const when = d.category === "PAY_ON_TIME" ? "if you pay on time" : d.category === "DIRECT_DEBIT" ? "by direct debit" : d.type === "GUARANTEED" || d.category === "GUARANTEED_DISCOUNT" ? "no conditions" : "with conditions";
  return { kind: "discount", headline: discountLabel(d), detail: when, inPrice: priced, value: pct || (d.amount ?? 0) };
}

/** Every reward on an offer, credits first. Duplicate headlines collapse. */
export function rewardsIn(x: PlanExtras | null): Reward[] {
  if (!x) return [];
  const out: Reward[] = [];
  const seen = new Set<string>();
  const add = (r: Reward | null) => {
    if (!r) return;
    const key = `${r.kind}|${r.headline.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };
  x.incentives.forEach((i) => add(rewardFromIncentive(i)));
  x.discounts.forEach((d) => add(rewardFromDiscount(d)));
  const order: RewardKind[] = ["credit", "points", "gift", "discount"];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.value - a.value);
}
