// Discounts, credits, fees and sign-up conditions for every offer, from the
// same Consumer Data Right feeds as the rates (each plan's `discounts`,
// `incentives`, `fees`, `eligibility`, `paymentOption` and contract terms).
//
// The daily pull (scripts/pull-plans.mjs) rewrites the three constants just
// below, each on one line. Until it has run with this code they're empty, and
// the site says the conditions haven't loaded yet (never "none").
//
// How they're used (decided with Phil, 18 Oct 2026):
//   - Percentage discounts come off the price: guaranteed ones, and the two
//     conditions most people meet, paying on time and paying by direct debit.
//     The page says the price assumes that, and what it costs if you don't.
//   - Shown, not priced: other conditional discounts (bundles and the like),
//     fixed-dollar discounts, sign-up credits and gifts, fees, and eligibility.
//   - Concessions are never counted. They depend on the customer, not the offer.
//   - An offer only some people can get (a membership, existing customers,
//     a seniors card...) is still listed, but never picked as "the best plan".

export const PLAN_EXTRAS_DATE: string | null = null;

export const PLAN_EXTRAS_LIST: PlanExtras[] = [];

export const PLAN_EXTRAS_INDEX: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Shapes (mirror the CDR fields, tidied by the pull)

export type DiscountType = "GUARANTEED" | "CONDITIONAL" | "OTHER";
export type DiscountCategory = "PAY_ON_TIME" | "DIRECT_DEBIT" | "GUARANTEED_DISCOUNT" | "OTHER";
export type DiscountMethod = "percentOfBill" | "percentOfUse" | "fixedAmount" | "percentOverThreshold";

export interface PlanDiscount {
  name: string;
  type: DiscountType;
  category: DiscountCategory | null;
  method: DiscountMethod;
  /** 0.03 = 3%. percentOfBill, percentOfUse and percentOverThreshold. */
  rate: number | null;
  /** Dollars, as the retailer publishes it. fixedAmount only. */
  amount: number | null;
  /** Usage above which percentOverThreshold applies (kWh, or MJ for gas). */
  threshold: number | null;
  /** Last day the discount is offered. */
  endDate: string | null;
  description: string | null;
}

export interface PlanIncentive {
  name: string;
  category: "GIFT" | "ACCOUNT_CREDIT" | "OTHER";
  description: string | null;
  eligibility: string | null;
}

export interface PlanFee {
  type: string;
  term: string | null;
  /** Dollars, as the retailer publishes it. */
  amount: number | null;
  /** 0.01 = 1%, for fees charged as a share of the bill. */
  rate: number | null;
  description: string | null;
}

export interface PlanEligibility {
  type: string;
  information: string | null;
  description: string | null;
}

export interface PlanExtras {
  discounts: PlanDiscount[];
  incentives: PlanIncentive[];
  fees: PlanFee[];
  eligibility: PlanEligibility[];
  /** How you can pay: PAPER_BILL, CREDIT_CARD, DIRECT_DEBIT, BPAY, OTHER. */
  payment: string[];
  /** 1_YEAR … 5_YEAR, ONGOING or OTHER. Null when the feed gives none. */
  term: string | null;
  benefitPeriod: string | null;
  coolingOffDays: number | null;
  onExpiry: string | null;
  termsUrl: string | null;
  eligibilityUrl: string | null;
}

export type Fuel = "E" | "G";

/** True once the daily pull has filled this file at least once. */
export const extrasLoaded = PLAN_EXTRAS_DATE !== null;

/** The offer's extras. Network-specific entry first (only stored when it
 *  differs from the plan's usual one), then the plan's usual entry. */
export function extrasFor(fuel: Fuel, retailer: string, planName: string, network?: string | null): PlanExtras | null {
  const base = `${fuel}|${retailer}|${planName}`;
  const i = (network ? PLAN_EXTRAS_INDEX[`${base}|${network}`] : undefined) ?? PLAN_EXTRAS_INDEX[base];
  return i === undefined ? null : PLAN_EXTRAS_LIST[i] ?? null;
}

// ---------------------------------------------------------------------------
// Pricing

const todayIso = () => new Date().toISOString().slice(0, 10);
/** Still offered today (no end date, or it hasn't passed). */
export const isLive = (d: PlanDiscount, today = todayIso()) => !d.endDate || d.endDate >= today;

/** No conditions: the feed calls it guaranteed, or files it as a guaranteed
 *  discount without calling it conditional. */
export function isGuaranteed(d: PlanDiscount): boolean {
  return d.type === "GUARANTEED" || (d.type !== "CONDITIONAL" && d.category === "GUARANTEED_DISCOUNT");
}

const isPercent = (d: PlanDiscount) => (d.method === "percentOfUse" || d.method === "percentOfBill") && d.rate !== null && d.rate > 0 && d.rate < 0.5;

/** A conditional discount we assume the customer gets: paying on time or by
 *  direct debit. Most people pay on time, and anyone can choose direct debit.
 *  (Victoria caps pay-on-time discounts at the retailer's reasonable cost of
 *  late payment, so what's lost by paying late is limited.) */
export const isAssumed = (d: PlanDiscount) => !isGuaranteed(d) && (d.category === "PAY_ON_TIME" || d.category === "DIRECT_DEBIT");

/** Taken off the price we show: a plain percentage, still offered, and
 *  guaranteed or one we assume (pay on time, direct debit). Fixed-dollar and
 *  over-a-threshold discounts are shown, not priced, because the feed doesn't
 *  say how often they apply; other conditions (bundles and so on) aren't
 *  something we can assume. */
export const isPriced = (d: PlanDiscount) => (isGuaranteed(d) || isAssumed(d)) && isPercent(d) && isLive(d);

/** The parts of a bill a discount can apply to, in dollars including GST. */
export interface BillParts {
  supply: number;
  /** Usage charges, including controlled load. */
  usage: number;
  solarCredit: number;
}

function discountDollars(d: PlanDiscount, p: BillParts): number {
  const r = d.rate ?? 0;
  if (d.method === "percentOfUse") return r * p.usage;
  // Off the bill after solar credits: the smaller, safer figure.
  if (d.method === "percentOfBill") return r * Math.max(0, p.supply + p.usage - p.solarCredit);
  return 0;
}

/** Dollars the guaranteed discounts take off this bill. */
export function guaranteedDiscount(x: PlanExtras | null, p: BillParts): number {
  if (!x) return 0;
  return x.discounts.filter((d) => isPriced(d) && isGuaranteed(d)).reduce((sum, d) => sum + discountDollars(d, p), 0);
}

/** Dollars the pay-on-time and direct-debit discounts take off this bill.
 *  In the price; it's also what paying late (or not by direct debit) costs. */
export function conditionalDiscount(x: PlanExtras | null, p: BillParts): number {
  if (!x) return 0;
  return x.discounts.filter((d) => isPriced(d) && isAssumed(d)).reduce((sum, d) => sum + discountDollars(d, p), 0);
}

/** Every discount in the price: guaranteed plus pay on time / direct debit. */
export function pricedDiscount(x: PlanExtras | null, p: BillParts): number {
  return guaranteedDiscount(x, p) + conditionalDiscount(x, p);
}

// ---------------------------------------------------------------------------
// Who can get it

export interface Household {
  hasSolar: boolean;
  /** Their retailer now, so "existing customers only" offers count for them. */
  currentRetailer?: string | null;
}

/** Eligibility that most households can't simply meet by choosing to. */
const RESTRICTS = new Set([
  "EXISTING_POOL", "EXISTING_BATTERY", "EXISTING_BASIC_METER", "SENIOR_CARD", "SMALL_BUSINESS", "SPORT_CLUB_MEMBER",
  "ORG_MEMBER", "LOYALTY_MEMBER", "GROUP_BUY_MEMBER", "THIRD_PARTY_ONLY", "REQ_EQUIP_SUPPLIER",
]);

export const ELIGIBILITY_LABEL: Record<string, string> = {
  EXISTING_CUST: "Existing customers only",
  EXISTING_POOL: "Homes with a pool",
  EXISTING_SOLAR: "Homes with solar",
  EXISTING_BATTERY: "Homes with a battery",
  EXISTING_SMART_METER: "Needs a smart meter",
  EXISTING_BASIC_METER: "Needs an older basic meter",
  SENIOR_CARD: "Seniors card holders only",
  SMALL_BUSINESS: "Small businesses only",
  NO_SOLAR_FIT: "Not for homes getting a solar feed-in credit",
  NEW_CUSTOMER: "New customers only",
  ONLINE_ONLY: "Online only: sign up, get bills and manage it online",
  REQ_EQUIP_SUPPLIER: "Must buy equipment from a set supplier",
  THIRD_PARTY_ONLY: "Only through a partner company",
  SPORT_CLUB_MEMBER: "Sports club members only",
  ORG_MEMBER: "Members of a set organisation only",
  SPECIFIC_LOCATION: "Some areas only",
  MINIMUM_USAGE: "Minimum usage applies",
  LOYALTY_MEMBER: "Loyalty program members only",
  GROUP_BUY_MEMBER: "Group-buy members only",
  CONTINGENT_PLAN: "Must also take another plan (such as gas) from this retailer",
  OTHER: "Other condition",
};

/** Short versions for a list label, where the long one is wordy. */
const RESTRICT_SHORT: Record<string, string> = {
  ORG_MEMBER: "Members only",
  SPORT_CLUB_MEMBER: "Club members only",
  LOYALTY_MEMBER: "Loyalty members only",
  GROUP_BUY_MEMBER: "Group-buy only",
  THIRD_PARTY_ONLY: "Partner sign-up only",
  REQ_EQUIP_SUPPLIER: "Set equipment supplier",
  SENIOR_CARD: "Seniors card holders",
  SMALL_BUSINESS: "Small businesses",
  EXISTING_POOL: "Homes with a pool",
  EXISTING_BATTERY: "Homes with a battery",
  EXISTING_BASIC_METER: "Basic meters only",
};

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return !t ? null : t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Join bits of text into sentences, without doubling full stops. */
const sentences = (...parts: (string | null | undefined)[]): string | null =>
  parts
    .filter((p): p is string => !!p && !!p.trim())
    .map((p) => { const t = p.trim(); return /[.!?…]$/.test(t) ? t : `${t}.`; })
    .join(" ") || null;

/** Plan names that say who they're for (also covers feeds that leave eligibility out). */
function restrictionFromName(planName: string): string | null {
  if (/\bmembers?\s+only\b|\b(current|existing)\b.*\bmembers?\b|\bfor\s+members\b/i.test(planName)) return "Members only";
  if (/\bexisting customers?\b/i.test(planName)) return "Existing customers only";
  if (/\bseniors?\b/i.test(planName)) return "Seniors only";
  return null;
}

/** Why this household probably can't get the offer, or null if anyone can. */
export function restrictionFor(x: PlanExtras | null, retailer: string, planName: string, h: Household): string | null {
  if (!x) return restrictionFromName(planName);
  for (const e of x.eligibility) {
    const label = ELIGIBILITY_LABEL[e.type] ?? ELIGIBILITY_LABEL.OTHER;
    if (RESTRICTS.has(e.type)) {
      const info = clip(e.information, 40);
      const short = RESTRICT_SHORT[e.type] ?? label;
      return info && info.toLowerCase() !== short.toLowerCase() ? `${short}: ${info}` : short;
    }
    if (e.type === "EXISTING_CUST" && h.currentRetailer !== retailer) return label;
    if (e.type === "EXISTING_SOLAR" && !h.hasSolar) return "Homes with solar only";
    if (e.type === "NO_SOLAR_FIT" && h.hasSolar) return label;
  }
  // The plan name is the retailer's own words too: "for current members" counts.
  return restrictionFromName(planName);
}

/** First offer anyone can get. Lists stay in price order; this picks the headline. */
export function topOpen<T extends { restricted: string | null }>(ranked: T[]): T | undefined {
  return ranked.find((m) => !m.restricted);
}

// ---------------------------------------------------------------------------
// Words for the page

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const pct = (r: number) => `${Math.round(r * 10000) / 100}%`;

export function discountLabel(d: PlanDiscount, unit = "kWh"): string {
  const r = d.rate !== null ? pct(d.rate) : null;
  if (d.method === "percentOfUse" && r) return `${r} off usage charges`;
  if (d.method === "percentOfBill" && r) return `${r} off the bill`;
  if (d.method === "percentOverThreshold" && r) return `${r} off usage over ${d.threshold ?? "a set amount of"} ${unit}`;
  if (d.method === "fixedAmount" && d.amount !== null) return `${money(d.amount)} off`;
  return d.name;
}

export function discountCondition(d: PlanDiscount): string {
  if (isGuaranteed(d)) return "No conditions";
  if (d.category === "PAY_ON_TIME") return "Our price assumes you pay every bill on time. Pay late and you lose it for that bill";
  if (d.category === "DIRECT_DEBIT") return "Our price assumes you pay by direct debit";
  return "Only if you meet the retailer's conditions, so it isn't in our price";
}

const FEE_LABEL: Record<string, string> = {
  EXIT: "Exit fee",
  ESTABLISHMENT: "Sign-up fee",
  LATE_PAYMENT: "Late payment fee",
  DISCONNECTION: "Disconnection fee",
  DISCONNECT_MOVE_OUT: "Disconnection fee (moving out)",
  DISCONNECT_NON_PAY: "Disconnection fee (unpaid bill)",
  RECONNECTION: "Reconnection fee",
  CONNECTION: "Connection fee",
  PAYMENT_PROCESSING: "Payment processing fee",
  CC_PROCESSING: "Credit card fee",
  CHEQUE_DISHONOUR: "Bounced cheque fee",
  DD_DISHONOUR: "Failed direct debit fee",
  MEMBERSHIP: "Membership fee",
  CONTRIBUTION: "Contribution fee",
  PAPER_BILL: "Paper bill fee",
  OTHER: "Other fee",
};
/** The fees people trip over first. */
const FEE_ORDER = ["MEMBERSHIP", "EXIT", "ESTABLISHMENT", "PAPER_BILL", "CC_PROCESSING", "PAYMENT_PROCESSING", "LATE_PAYMENT", "DD_DISHONOUR"];

export function feeAmount(f: PlanFee): string | null {
  if (f.term === "PERCENT_OF_BILL") return f.rate !== null ? `${pct(f.rate)} of the bill` : null;
  if (f.amount === null) return null;
  const $ = money(f.amount);
  switch (f.term) {
    case "DAILY": return `${$} a day`;
    case "WEEKLY": return `${$} a week`;
    case "MONTHLY": return `${$} a month`;
    case "ANNUAL": return `${$} a year`;
    case "BIANNUAL": return `${$} every 6 months`;
    case "VARIABLE": return `up to ${$}`;
    case "1_YEAR": case "2_YEAR": case "3_YEAR": case "4_YEAR": case "5_YEAR":
      return f.type === "EXIT" ? `${$} if you leave in the first ${f.term[0] === "1" ? "year" : `${f.term[0]} years`}` : $;
    default: return $;
  }
}

const PAYMENT_LABEL: Record<string, string> = { DIRECT_DEBIT: "direct debit", CREDIT_CARD: "credit card", BPAY: "BPAY", PAPER_BILL: "paying a paper bill", OTHER: "other ways" };

export function termLabel(term: string | null): string | null {
  if (!term) return null;
  if (term === "ONGOING") return "No fixed contract term";
  const m = term.match(/^(\d)_YEAR$/);
  if (m) return `${m[1]}-year contract`;
  return "Contract term: see the retailer's terms";
}

export type Tone = "good" | "info" | "warn";
export interface OfferLine {
  text: string;
  detail?: string | null;
  tone: Tone;
}

export interface OfferSummary {
  /** The daily pull has loaded conditions at least once. */
  loaded: boolean;
  /** This offer has an entry. */
  found: boolean;
  /** Each discount: in the price (good) or only if you meet the condition (info). */
  discounts: OfferLine[];
  /** What signing up needs: eligibility, how you must pay, online only… */
  needs: OfferLine[];
  /** Sign-up credits, gifts and other bonuses. Not in the price. */
  credits: OfferLine[];
  fees: OfferLine[];
  contract: OfferLine[];
  /** Why this household probably can't get it, or null. */
  restricted: string | null;
  /** Up to three short labels for a list row, most important first. */
  chips: OfferLine[];
  /** How many labels didn't fit in `chips`. */
  moreChips: number;
  termsUrl: string | null;
  eligibilityUrl: string | null;
}

/** Everything a customer should know about an offer's discounts and
 *  conditions, in plain words, for this household. */
export function describeOffer(
  fuel: Fuel,
  retailer: string,
  planName: string,
  network: string | null,
  h: Household,
): OfferSummary {
  const x = extrasFor(fuel, retailer, planName, network);
  const unit = fuel === "G" ? "MJ" : "kWh";
  const restricted = restrictionFor(x, retailer, planName, h);
  const out: OfferSummary = {
    loaded: extrasLoaded, found: !!x, discounts: [], needs: [], credits: [], fees: [], contract: [],
    restricted, chips: [], moreChips: 0, termsUrl: x?.termsUrl ?? null, eligibilityUrl: x?.eligibilityUrl ?? null,
  };
  const chips: OfferLine[] = [];
  if (restricted) chips.push({ text: restricted, tone: "warn" });
  if (!x) {
    out.chips = chips;
    if (restricted) out.needs.push({ text: restricted, detail: "Going by the plan name. Check with the retailer that you can get it.", tone: "warn" });
    return out;
  }

  const live = x.discounts.filter((d) => isLive(d));
  const when = (d: PlanDiscount) => (d.category === "PAY_ON_TIME" ? "pay on time" : d.category === "DIRECT_DEBIT" ? "direct debit" : "conditions");
  for (const d of live) {
    const priced = isPriced(d);
    const status = priced
      ? isGuaranteed(d) ? "in our price, no conditions" : `in our price (${when(d)})`
      : isGuaranteed(d) ? "not in our price (check how often it applies)" : "not in our price";
    out.discounts.push({
      text: `${discountLabel(d, unit)}: ${status}`,
      detail: sentences(isGuaranteed(d) ? null : discountCondition(d), d.endDate ? `Offered until ${fmtIso(d.endDate)}` : null, clip(d.description, 220)),
      tone: priced ? "good" : "info",
    });
  }
  const short = (d: PlanDiscount) => discountLabel(d, unit).replace(/ charges$/, "");
  const pricedOnes = live.filter(isPriced);
  const unpricedConditional = live.filter((d) => !isGuaranteed(d) && !isPriced(d));
  if (pricedOnes.length) {
    chips.push({ text: `${pricedOnes.map((d) => (isGuaranteed(d) ? short(d) : `${short(d)} (${when(d)})`)).join(" + ")} included`, tone: "good" });
  }
  for (const d of unpricedConditional.slice(0, 1)) chips.push({ text: `${short(d)} with conditions`, tone: "info" });

  // What signing up needs.
  for (const e of x.eligibility) {
    const label = ELIGIBILITY_LABEL[e.type] ?? ELIGIBILITY_LABEL.OTHER;
    const info = clip(e.information, 160);
    const isBlock = restricted !== null && (RESTRICTS.has(e.type) || e.type === "EXISTING_CUST" || e.type === "EXISTING_SOLAR" || e.type === "NO_SOLAR_FIT");
    out.needs.push({ text: e.type === "OTHER" && info ? info : label, detail: e.type === "OTHER" ? clip(e.description, 200) : sentences(info, clip(e.description, 200)), tone: isBlock ? "warn" : "info" });
    if (!isBlock && (e.type === "ONLINE_ONLY" || e.type === "CONTINGENT_PLAN" || e.type === "NEW_CUSTOMER")) {
      chips.push({ text: e.type === "ONLINE_ONLY" ? "Online only" : e.type === "NEW_CUSTOMER" ? "New customers only" : "Needs another plan too", tone: "info" });
    }
  }
  const pays = x.payment.filter((p) => p !== "OTHER");
  if (pays.length === 1 && pays[0] === "DIRECT_DEBIT") {
    out.needs.push({ text: "You must pay by direct debit", detail: null, tone: "info" });
    chips.push({ text: "Direct debit only", tone: "info" });
  } else if (pays.length > 0) {
    out.needs.push({ text: `Pay by ${pays.map((p) => PAYMENT_LABEL[p] ?? p.toLowerCase()).join(", ")}`, detail: null, tone: "info" });
  }
  for (const d of live.filter((v) => !isGuaranteed(v))) {
    const inPrice = isPriced(d) ? " (our price assumes you do)" : "";
    if (d.category === "DIRECT_DEBIT") out.needs.push({ text: `Pay by direct debit to get the ${discountLabel(d, unit)}${inPrice}`, detail: null, tone: "info" });
    else if (d.category === "PAY_ON_TIME") out.needs.push({ text: `Pay every bill on time to get the ${discountLabel(d, unit)}${inPrice}`, detail: null, tone: "info" });
  }

  for (const i of x.incentives) {
    out.credits.push({
      text: `${i.name}${i.category === "ACCOUNT_CREDIT" ? " (bill credit)" : i.category === "GIFT" ? " (gift)" : ""}`,
      detail: sentences(clip(i.description, 200), i.eligibility ? `Who gets it: ${clip(i.eligibility, 140)}` : null),
      tone: "info",
    });
  }
  const credit = x.incentives.find((i) => i.category === "ACCOUNT_CREDIT") ?? x.incentives[0];
  if (credit) chips.push({ text: clip(credit.name, 34) ?? "Sign-up bonus", tone: "info" });

  const fees = [...x.fees].sort((a, b) => (FEE_ORDER.indexOf(a.type) + 1 || 99) - (FEE_ORDER.indexOf(b.type) + 1 || 99));
  for (const f of fees) {
    const amt = feeAmount(f);
    if (f.amount === 0 && f.rate === null) continue;
    out.fees.push({ text: `${FEE_LABEL[f.type] ?? FEE_LABEL.OTHER}${amt ? `: ${amt}` : ""}`, detail: clip(f.description, 180), tone: f.type === "EXIT" || f.type === "MEMBERSHIP" ? "warn" : "info" });
  }
  const exit = x.fees.find((f) => f.type === "EXIT" && (f.amount ?? 0) > 0);
  if (exit) chips.push({ text: "Exit fee", tone: "warn" });
  const member = x.fees.find((f) => f.type === "MEMBERSHIP" && (f.amount ?? 0) > 0);
  if (member) chips.push({ text: `Membership fee${feeAmount(member) ? ` ${feeAmount(member)}` : ""}`, tone: "warn" });

  const term = termLabel(x.term);
  if (term) out.contract.push({ text: term, detail: null, tone: "info" });
  if (x.benefitPeriod) out.contract.push({ text: `Benefit period: ${clip(x.benefitPeriod, 120)}`, detail: "Discounts or credits can stop after this. Prices can jump when they do.", tone: "warn" });
  if (x.onExpiry) out.contract.push({ text: "When it ends", detail: clip(x.onExpiry, 220), tone: "info" });
  if (x.coolingOffDays) out.contract.push({ text: `${x.coolingOffDays}-day cooling-off`, detail: "You can cancel within this time without a penalty.", tone: "info" });

  out.chips = chips.slice(0, 3);
  out.moreChips = Math.max(0, chips.length - 3);
  return out;
}

function fmtIso(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
