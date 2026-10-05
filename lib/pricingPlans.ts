// Prices (Phil, 3 Oct 2026; rounded to clean whole dollars 5 Oct 2026). Everything else in the checkout flow
// reads from this file, so changing a price here is the only change needed
// if these ever need updating later.
export type PlanId = "monthly" | "quarterly" | "half_yearly" | "once_off";

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
}

export const PRICING_PLANS: PricingPlan[] = [
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
  },
  {
    id: "once_off",
    name: "Once-off",
    cadenceLabel: "one payment",
    priceCents: 5900,
    currency: "aud",
    mode: "payment",
    blurb: "Pay once, monitored for good — no renewals.",
  },
];

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
  monthly: {
    tag: { label: "Flexible", tone: "navy" },
    perMonthCents: MONTHLY,
    note: "Pay month to month. Stop any time.",
    features: ["Monthly price check", "Email when something is cheaper", "Bill photo and PDF reading"],
  },
  quarterly: {
    tag: { label: "Most popular", tone: "amber" },
    perMonthCents: 600,
    anchorCents: MONTHLY * 3,
    note: "Our most-picked plan.",
    featured: true,
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

export function savePct(plan: PricingPlan): number | null {
  const a = PLAN_DISPLAY[plan.id].anchorCents;
  return a ? Math.round((1 - plan.priceCents / a) * 100) : null;
}
