// "We checked your bill" (2 Nov 2026): everything the bill check can flag,
// as one ranked list. Each finding is "act" (money to get back or save by a
// phone call), "look" (something worth checking), "ok" (checked and fine) or
// "info" (worth knowing). Pure: the card only draws what this returns.

import type { CurrentRates } from "./billExtraction";
import type { PlanRow } from "./plans";

export type IssueLevel = "act" | "look" | "info" | "ok";
export type FeeKind = "late_payment" | "paper_bill" | "payment_processing" | "reconnection" | "other";

export interface BillFee {
  kind: FeeKind;
  amount: number;
}

export interface BillMoney {
  rates: CurrentRates | null;
  days: number;
  anytime: number;
  peak: number;
  shoulder: number;
  offpeak: number;
  cl: number;
  solarExportKwh: number;
  /** The bill's own total for the period, if read. */
  total: number | null;
  distributor: string;
}

export interface IssueInput {
  retailer: string;
  readingType: "actual" | "estimated" | "mixed" | null;
  concession: boolean;
  /** Only on screen during a check, never stored. */
  behind: boolean;
  paymentPlan: boolean;
  bestOffer: { planName: string | null; savingPerYear: number | null; saysOnBest: boolean } | null;
  fees: BillFee[];
  /** The bill says a pay-on-time or conditional discount wasn't applied. */
  discountLost: boolean;
  billPlanName: string;
  olderVersion: { planName: string; perMonth: number; perYear: number } | null;
  planIsCurrent: boolean;
  retailerBest: { planName: string; savingPerYear: number; tariff?: "flat" | "tou" | null } | null;
  retailerCount: number;
  worthPerYear: number;
  money?: BillMoney | null;
  /** Today's plans on the member's network (for "dearer than anything on sale"). */
  plans?: PlanRow[];
}

export interface BillIssue {
  id: string;
  level: IssueLevel;
  title: string;
  body: string;
  /** Dollars a year at stake, when we can say. */
  perYear?: number;
}

const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
const money = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const c1 = (d: number) => `${(d * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}c`;

const FEE_LABEL: Record<FeeKind, string> = {
  late_payment: "late-payment fee",
  paper_bill: "paper-bill fee",
  payment_processing: "card or payment fee",
  reconnection: "disconnection or reconnection fee",
  other: "other fee",
};
const FEE_TIP: Partial<Record<FeeKind, string>> = {
  late_payment: "direct debit or a reminder a few days before the due date avoids it",
  paper_bill: "switching to email bills usually removes it",
  payment_processing: "paying by bank transfer or direct debit from a bank account usually avoids it",
};

/** Is this a time-of-use bill (peak and off-peak, no single rate)? */
export function billTariff(r: CurrentRates | null): "flat" | "tou" | null {
  if (!r) return null;
  if (r.peak !== null && r.offpeak !== null && r.anytime === null) return "tou";
  if (r.anytime !== null) return "flat";
  return null;
}

/** What the bill's own rates add up to for its usage, before fees, discounts and credits. */
export function chargesFromRates(m: BillMoney): number | null {
  const r = m.rates;
  if (!r || r.supply === null || !(m.days > 0)) return null;
  const general = m.anytime + m.peak + m.shoulder + m.offpeak;
  let usage: number | null = null;
  const t = billTariff(r);
  if (t === "flat") usage = (r.anytime as number) * general;
  else if (t === "tou") usage = (r.peak ?? 0) * (m.peak + m.anytime) + (r.shoulder ?? r.peak ?? 0) * m.shoulder + (r.offpeak ?? 0) * m.offpeak;
  if (usage === null) return null;
  if (m.cl > 0) {
    if (r.cl === null) return null; // a controlled-load rate we couldn't read: don't guess
    usage += r.cl * m.cl;
  }
  const solar = r.solarFit !== null && m.solarExportKwh > 0 ? r.solarFit * m.solarExportKwh : 0;
  return usage + r.supply * m.days - solar;
}

/** The dearest supply and single usage rate on sale on a network today (market and standing offers). */
export function dearestOnSale(plans: PlanRow[], distributor: string): { supply: number; anytime: number | null; peak: number | null } | null {
  let supply = 0, anytime: number | null = null, peak: number | null = null;
  let n = 0;
  for (const p of plans) {
    if (p[1] !== distributor) continue;
    n++;
    if (p[4] > supply) supply = p[4];
    if (p[5] !== null && (anytime === null || p[5] > anytime)) anytime = p[5];
    if (p[6] !== null && (peak === null || p[6] > peak)) peak = p[6];
  }
  return n ? { supply, anytime, peak } : null;
}

export function billIssues(x: IssueInput): BillIssue[] {
  const who = x.retailer || "your retailer";
  const out: BillIssue[] = [];

  if (x.behind) {
    out.push({
      id: "behind",
      level: "info",
      title: x.paymentPlan ? "Your bill mentions a payment plan." : "Your bill shows an amount overdue.",
      body: `If you're behind, talk to ${who} before you switch: retailers have to offer payment help, and switching can end a payment arrangement.`,
    });
  }

  // Same company, cheaper price: an older version of the same plan, or a better plan or tariff.
  if (x.olderVersion) {
    out.push({
      id: "older",
      level: "act",
      title: "Same plan name, older price.",
      body: `Your bill says "${x.billPlanName}". ${who}'s current "${x.olderVersion.planName}" costs about ${money(x.olderVersion.perMonth)} a month less for the same usage. Ask ${who} to move you to the current version: same company, no switch.`,
      perYear: x.olderVersion.perYear,
    });
  } else if (x.retailerBest && x.retailerBest.savingPerYear >= x.worthPerYear) {
    const now = billTariff(x.money?.rates ?? null);
    const other = x.retailerBest.tariff && now && x.retailerBest.tariff !== now ? x.retailerBest.tariff : null;
    out.push({
      id: "tariff",
      level: "act",
      title: other ? (other === "tou" ? "A time-of-use plan suits your usage better." : "A single-rate plan suits your usage better.") : `${who} has a cheaper plan for you.`,
      body: `${who}'s "${x.retailerBest.planName}" is about ${whole(x.retailerBest.savingPerYear)} a year less than your bill for the same usage${other ? `: you're on ${now === "tou" ? "peak and off-peak pricing" : "one price all day"}, and your pattern is cheaper the other way` : ""}. Ask ${who} to move you: same company, no switch.`,
      perYear: x.retailerBest.savingPerYear,
    });
  } else if (x.planIsCurrent) {
    out.push({ id: "current", level: "ok", title: "Your plan is current.", body: `"${x.billPlanName}" matches ${who}'s plan on sale today.` });
  }

  // Rates dearer than anything on sale on the network: a red flag for an old or wrong tariff.
  const m = x.money;
  if (m?.rates && x.plans) {
    const top = dearestOnSale(x.plans, m.distributor);
    const t = billTariff(m.rates);
    if (top) {
      const usageRate = t === "flat" ? m.rates.anytime : t === "tou" ? m.rates.peak : null;
      const usageTop = t === "flat" ? top.anytime : t === "tou" ? top.peak : null;
      const overUse = usageRate !== null && usageTop !== null && usageRate > usageTop + 0.005;
      const overSupply = m.rates.supply !== null && m.rates.supply > top.supply + 0.02;
      if (overUse || overSupply) {
        const parts = [
          overUse ? `${t === "tou" ? "peak rate" : "usage rate"} of ${c1(usageRate as number)} a kWh (the dearest on sale is ${c1(usageTop as number)})` : null,
          overSupply ? `supply charge of ${money(m.rates.supply as number)} a day (the dearest on sale is ${money(top.supply)})` : null,
        ].filter(Boolean);
        out.push({
          id: "dearer",
          level: "act",
          title: "Your rates are dearer than any plan on sale.",
          body: `Your bill shows a ${parts.join(" and a ")} on the ${m.distributor} network. That usually means an old plan or the wrong tariff. Ask ${who} why, or switch.`,
        });
      }
    }
  }

  // Fees, and charges the rates don't explain.
  const fees = x.fees.filter((f) => f.amount > 0);
  const feeTotal = fees.reduce((t, f) => t + f.amount, 0);
  if (fees.length) {
    const tips = Array.from(new Set(fees.map((f) => FEE_TIP[f.kind]).filter(Boolean)));
    out.push({
      id: "fees",
      level: "look",
      title: `Fees on this bill: ${money(feeTotal)}.`,
      body: `${fees.map((f) => `${money(f.amount)} ${FEE_LABEL[f.kind]}`).join(", ")}.${tips.length ? ` Easy to avoid: ${tips.join("; ")}.` : ""}`,
      perYear: m && m.days > 0 ? (feeTotal * 365) / m.days : undefined,
    });
  }
  if (x.discountLost) {
    out.push({
      id: "discount",
      level: "look",
      title: "A discount wasn't applied.",
      body: `Your bill says a pay-on-time or conditional discount didn't apply this time. If you paid on time, ask ${who} to apply it.`,
    });
  }
  if (m && m.total !== null && m.total > 0) {
    const expected = chargesFromRates(m);
    if (expected !== null && expected > 0) {
      const extra = m.total - expected - feeTotal;
      if (extra >= Math.max(15, m.total * 0.06)) {
        out.push({
          id: "unexplained",
          level: "look",
          title: `About ${whole(extra)} we can't match to your usage.`,
          body: `Your rates and usage come to about ${money(expected)}${feeTotal ? `, plus ${money(feeTotal)} in fees` : ""}, but the bill is ${money(m.total)}. It could be a meter charge, a back-bill or an adjustment from an earlier bill. Check the charges page, and ask ${who} about anything you don't recognise.`,
        });
      }
    }
  }

  // The retailer's own "best offer" message.
  const bo = x.bestOffer;
  if (bo) {
    const rb = x.retailerBest;
    const disagree = bo.saysOnBest && rb && rb.savingPerYear >= x.worthPerYear;
    out.push({
      id: "bestoffer",
      level: disagree ? "look" : "info",
      title: "Your retailer's message.",
      body: `${bo.saysOnBest ? `Your bill says you're on ${who}'s best offer.` : `Your bill says you could save${bo.savingPerYear ? ` ${whole(bo.savingPerYear)} a year` : ""}${bo.planName ? ` on "${bo.planName}"` : ""}.`} ${rb ? (rb.savingPerYear >= x.worthPerYear ? `We priced ${who}'s plans on your usage: "${rb.planName}" is about ${whole(rb.savingPerYear)} a year less than your bill.` : `We agree: nothing from ${who} beats your bill by ${whole(x.worthPerYear)} a year or more.`) : ""} Retailers only compare their own plans; we compare ${x.retailerCount} retailers.`.replace(/\s+/g, " ").trim(),
    });
  }

  if (x.readingType) {
    out.push(
      x.readingType === "actual"
        ? { id: "read", level: "ok", title: "Actual meter read.", body: "This bill uses a real reading, so the usage is reliable." }
        : {
            id: "read",
            level: "look",
            title: `${x.readingType === "mixed" ? "Part" : "Estimated"} meter read.`,
            body: `The usage on this bill is a guess, so it may be too high or too low. Ask ${who} for an actual read, or send them a photo of your meter. Our comparison uses the same estimate.`,
          },
    );
  }

  out.push(
    x.concession
      ? { id: "concession", level: "ok", title: "Concession applied.", body: "Give your card details again if you change retailer; it doesn't move with you." }
      : {
          id: "concession",
          level: "info",
          title: "No concession on this bill.",
          body: `If you have a pensioner, health care or DVA card, ask ${who} to add the Victorian annual electricity concession. It isn't automatic.`,
        },
  );

  const rank: Record<IssueLevel, number> = { act: 0, look: 1, info: 2, ok: 3 };
  // "behind" always leads; the rest by level, keeping their order within a level.
  return out
    .map((i, n) => ({ i, n }))
    .sort((a, b) => (a.i.id === "behind" ? -1 : b.i.id === "behind" ? 1 : rank[a.i.level] - rank[b.i.level] || a.n - b.n))
    .map(({ i }) => i);
}

/** "2 things worth a look" / "Nothing looks off" for the card's header. */
export function issueSummary(list: BillIssue[]): { flagged: number; text: string } {
  const flagged = list.filter((i) => i.level === "act" || i.level === "look").length;
  return { flagged, text: flagged === 0 ? "Nothing looks off" : `${flagged} thing${flagged === 1 ? "" : "s"} worth a look` };
}
