// Prices (Phil, 3 Oct 2026; rounded to clean whole dollars 5 Oct 2026). Everything else in the checkout flow
// reads from this file, so changing a price here is the only change needed
// if these ever need updating later.
export type PlanId = "annual" | "monthly" | "quarterly" | "half_yearly" | "once_off";

export interface PricingPlan {
  id: PlanId;
  name: string;
  cadenceLabel: string;
  priceCents: number;
  currency: "aud";
  // Stripe Checkout mode: a recurring plan creates a subscription; the
  // once-off plan is a single payment with no ongoing billing.
  mode: "subscription" | "payment";
  // For subscription plans: billed every `intervalCount` `interval`s.
  interval?: "month";
  intervalCount?: number;
  blurb: string;
  /** Offered to new sign-ups. Plans set false still work for existing members. */
  onSale: boolean;
}

// Annual first (Oct 2026): energy savings come in a few moments a year, so a
// yearly price that's clearly below the typical saving keeps the maths in the
// customer's favour and cuts churn. Monthly stays for people who want to try it.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "annual",
    name: "Yearly",
    cadenceLabel: "per year",
    priceCents: 3900,
    currency: "aud",
    mode: "subscription",
    interval: "month",
    intervalCount: 12,
    blurb: "One payment a year. Cancel any time.",
    onSale: true,
  },
  {
    id: "monthly",
    name: "Monthly",
    cadenceLabel: "per month",
    priceCents: 700,
    currency: "aud",
    mode: "subscription",
    interval: "month",
    intervalCount: 1,
    blurb: "Cancel anytime.",
    onSale: true,
  },
  {
    id: "quarterly",
    name: "Quarterly",
    cadenceLabel: "every 3 months",
    priceCents: 1800,
    currency: "aud",
    mode: "subscription",
    interval: "month",
    intervalCount: 3,
    blurb: "Works out cheaper than paying monthly.",
    onSale: false,
  },
  {
    id: "half_yearly",
    name: "Half-yearly",
    cadenceLabel: "every 6 months",
    priceCents: 3300,
    currency: "aud",
    mode: "subscription",
    interval: "month",
    intervalCount: 6,
    blurb: "Our best ongoing value.",
    onSale: false,
  },
  {
    id: "once_off",
    name: "Once-off",
    cadenceLabel: "one payment",
    priceCents: 5900,
    currency: "aud",
    mode: "payment",
    blurb: "Pay once, monitored for good — no renewals.",
    onSale: false,
  },
];

/** The plans shown to new customers, in display order. */
export const PLANS_ON_SALE: PricingPlan[] = PRICING_PLANS.filter((p) => p.onSale);

export function findPlan(id: string): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === id);
}

export function fmtPrice(cents: number): string {
  const whole = cents % 100 === 0;
  return (
    "$" +
    (cents / 100).toLocaleString("en-AU", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
  );
}

export interface PlanDisplay {
  tag?: { label: string; tone: "amber" | "teal" | "navy" | "green" };
  /** shown big beside the price, e.g. "$6/mo" */
  perMonthCents?: number;
  /** struck-through "would have cost" anchor, in cents */
  anchorCents?: number;
  /** small line under the price */
  note: string;
  featured?: boolean;
  features: string[];
}

const MONTHLY = 700;
// Pricing psychology used here: a charm-free clean price ($7, $18, $33, $59),
// the Monthly plan as an anchor that makes longer plans look like a discount,
// a struck-through "would cost" figure, a per-month equivalent, and one
// featured middle option. Savings are computed from the anchor, not hard-coded.
export const PLAN_DISPLAY: Record<PlanId, PlanDisplay> = {
  annual: {
    tag: { label: "Best value", tone: "green" },
    anchorCents: MONTHLY * 12,
    note: "One payment a year. Cancel any time.",
    featured: true,
    features: ["Prices re-checked daily, summary monthly", "Alerts before your discount or fixed price ends", "1 July price-change re-check", "More bill reads (10 a day), every result saved"],
  },
  monthly: {
    tag: { label: "Flexible", tone: "navy" },
    perMonthCents: MONTHLY,
    note: "Pay month to month. Stop any time.",
    features: ["Prices re-checked daily, summary monthly", "Alerts before your discount or fixed price ends", "1 July price-change re-check", "More bill reads (10 a day), every result saved"],
  },
  quarterly: {
    tag: { label: "Lower monthly cost", tone: "amber" },
    perMonthCents: 600,
    anchorCents: MONTHLY * 3,
    note: "Same service, billed every 3 months.",
    features: ["Everything in Monthly", "Billed once a quarter", "Cancel any time"],
  },
  half_yearly: {
    tag: { label: "Best value", tone: "green" },
    perMonthCents: 550,
    anchorCents: MONTHLY * 6,
    note: "Lowest price per month.",
    features: ["Everything in Monthly", "Billed twice a year", "Cancel any time"],
  },
  once_off: {
    tag: { label: "No renewals", tone: "teal" },
    anchorCents: MONTHLY * 12,
    note: "Pay once. Monitored for good.",
    features: ["Everything in Monthly", "Never renews", "Monitored for good"],
  },
};

/** What the paid tier is called everywhere on the site (Oct 2026: was "membership"). */
export const PLUS_NAME = "Utilo Plus";
export const PLUS_SHORT = "Plus";

/**
 * The value framing (Phil, 29 Oct 2026): lead with the monthly price, show
 * what it adds up to over a year, then what paying yearly saves. All from the
 * price list, so it can't drift.
 */
export function plusValue() {
  const monthly = findPlan("monthly")!;
  const annual = findPlan("annual")!;
  const monthlyYear = monthly.priceCents * 12;
  const save = monthlyYear - annual.priceCents;
  return {
    monthly: fmtPrice(monthly.priceCents),
    monthlyYear: fmtPrice(monthlyYear),
    annual: fmtPrice(annual.priceCents),
    save: fmtPrice(save),
    savePct: Math.round((save / monthlyYear) * 100),
    /** "$7 a month is $84 a year. Pay yearly: $39, you save $45." */
    line: `${fmtPrice(monthly.priceCents)} a month is ${fmtPrice(monthlyYear)} a year. Pay yearly: ${fmtPrice(annual.priceCents)}, you save ${fmtPrice(save)}.`,
  };
}

export function savePct(plan: PricingPlan): number | null {
  const a = PLAN_DISPLAY[plan.id].anchorCents;
  return a ? Math.round((1 - plan.priceCents / a) * 100) : null;
}
