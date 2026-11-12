// Prices (Phil, 3 Oct 2026; rounded to clean whole dollars 5 Oct 2026). Everything else in the checkout flow
// reads from this file, so changing a price here is the only change needed
// if these ever need updating later.
export type PlanId = "annual" | "monthly" | "quarterly" | "half_yearly" | "once_off";

/**
 * The New Year special (Phil, 2 Nov 2026; yearly changed to $55 → $45 the same
 * evening): $45 a year or $7 a month for anyone who joins before 1 February 2027
 * (midnight in Melbourne), kept for as long as they stay. From then, new members
 * pay the regular $55 / $9 automatically:
 * the prices below, the checkout and the wording all switch on their own.
 */
export const SPECIAL_NAME = "New Year special";
export const SPECIAL_ENDS_LABEL = "1 February 2027";
export const SPECIAL_ENDS_SHORT = "1 Feb";
/** The bubble on the plan cards (Phil, 2 Nov 2026). */
export const SALE_BUBBLE = "Sale · until 1 Feb 2027";
const SPECIAL_ENDS_AT = Date.parse("2027-01-31T13:00:00Z"); // 1 Feb 2027 00:00 in Melbourne (AEDT)
export function foundingOpenAt(t: number = Date.now()): boolean {
  return t < SPECIAL_ENDS_AT;
}
const OPEN_NOW = foundingOpenAt();

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
    priceCents: OPEN_NOW ? 4500 : 5500,
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
    priceCents: OPEN_NOW ? 700 : 900,
    currency: "aud",
    mode: "subscription",
    interval: "month",
    intervalCount: 1,
    blurb: "Cancel anytime.",
    // 12 Nov 2026 (Phil): one price, yearly only. Monthly members keep their plan.
    onSale: false,
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
    /** "$7 a month is $84 a year. Pay yearly: $45, you save $39." */
    line: `${fmtPrice(monthly.priceCents)} a month is ${fmtPrice(monthlyYear)} a year. Pay yearly: ${fmtPrice(annual.priceCents)}, you save ${fmtPrice(save)}.`,
    /** "$45 a year, 87c a week." (12 Nov 2026: yearly is the only plan on sale.) */
    yearLine: `${fmtPrice(annual.priceCents)} a year, ${annual.priceCents / 52 < 100 ? `${Math.round(annual.priceCents / 52)}c` : fmtPrice(Math.round(annual.priceCents / 52))} a week`,
    /** The yearly price a week: "87c". */
    perWeek: annual.priceCents / 52 < 100 ? `${Math.round(annual.priceCents / 52)}c` : fmtPrice(Math.round(annual.priceCents / 52)),
  };
}

/**
 * Founding members (2 Nov 2026): the launch price stays theirs for as long as
 * they're a member. Stripe keeps each subscription on the price it started
 * with, so a later price rise only reaches new members. Turn the wording off
 * here when the founding offer closes.
 */
export const FOUNDING_OFFER = OPEN_NOW;

/**
 * The regular prices (Phil, 2 Nov 2026): $55 a year, $9 a month. While the
 * founding offer runs, new members pay the founding prices below and these show
 * struck through beside them. When the offer closes: set each plan's
 * priceCents above to its regular price and FOUNDING_OFFER to false. Only show
 * these as "regular" if they really become the price for new members.
 */
export const REGULAR_PRICES: Partial<Record<PlanId, number>> = { annual: 5500, monthly: 900 };

/** The regular price to show struck through, or null (no founding offer, or not higher than today's price). */
export function regularPrice(id: PlanId): number | null {
  const r = REGULAR_PRICES[id];
  const now = findPlan(id)?.priceCents ?? 0;
  return FOUNDING_OFFER && r !== undefined && r > now ? r : null;
}

/** The launch (founding) prices. Keep these as they are when list prices go up: founders switching plans get these. */
export const FOUNDING_PRICES: Partial<Record<PlanId, number>> = { annual: 4500, monthly: 700 };
/** Anyone who joined at $39 a year (the special's first price, 2 Nov 2026) keeps that too. */
const EARLIER_FOUNDING: Partial<Record<PlanId, number[]>> = { annual: [3900] };

/** Is this member on a founding price? (Their plan's charge equals a founding price.) */
export function isFoundingAmount(planId: string, amountCents: number | null | undefined): boolean {
  const f = FOUNDING_PRICES[planId as PlanId];
  if (amountCents == null) return false;
  return (f !== undefined && amountCents === f) || (EARLIER_FOUNDING[planId as PlanId] ?? []).includes(amountCents);
}

/** What a new member pays right now (checked at the moment of checkout, not when the server started). */
export function listPriceNow(planId: PlanId, t: number = Date.now()): number {
  const base = findPlan(planId)?.priceCents ?? 0;
  if (foundingOpenAt(t)) return FOUNDING_PRICES[planId] ?? base;
  return REGULAR_PRICES[planId] ?? base;
}

/** What a plan costs this member: the founding price for founders, otherwise today's list price. */
export function priceFor(planId: PlanId, founding: boolean): number {
  const list = listPriceNow(planId);
  const f = FOUNDING_PRICES[planId];
  return founding && f !== undefined ? Math.min(f, list) : list;
}

/** "under $1 a week" while the yearly price allows it, otherwise "about $1.06 a week". */
export function perWeekWords(): string {
  const c = findPlan("annual")!.priceCents / 52;
  return c < 100 ? "under $1 a week" : `about $${(c / 100).toFixed(2)} a week`;
}
export const foundingLine = () => {
  const ra = regularPrice("annual");
  return `Founding price: ${fmtPrice(findPlan("annual")!.priceCents)} a year, locked in while you stay.${ra ? ` New members pay ${fmtPrice(ra)} from ${SPECIAL_ENDS_LABEL}.` : ""}`;
};
/** The small print under a struck-through regular price (12 Nov 2026): the regular price is real from this date. */
export const regularFromLine = () => {
  const ra = regularPrice("annual");
  return ra ? `New members pay ${fmtPrice(ra)} from ${SPECIAL_ENDS_SHORT} 2027` : null;
};

/** How many times over a yearly saving pays for the yearly price (1 decimal under 10), or null if under 2×. */
export function timesPrice(yearlySaving: number): string | null {
  const x = yearlySaving / (findPlan("annual")!.priceCents / 100);
  if (!(x >= 2)) return null;
  return x >= 10 ? `${Math.floor(x)}` : `${Math.floor(x * 10) / 10}`.replace(/\.0$/, "");
}

export function savePct(plan: PricingPlan): number | null {
  const a = PLAN_DISPLAY[plan.id].anchorCents;
  return a ? Math.round((1 - plan.priceCents / a) * 100) : null;
}
