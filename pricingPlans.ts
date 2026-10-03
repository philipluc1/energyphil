// Confirmed prices (Phil, 3 Oct 2026). Everything else in the checkout flow
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
    priceCents: 699,
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
    priceCents: 1799,
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
    priceCents: 3299,
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
  return "$" + (cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
