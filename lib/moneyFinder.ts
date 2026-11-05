import type { BillFee } from "./billIssues";

// 5 Nov 2026: "find money on every bill". The bill check (lib/billIssues.ts) says
// what looks off; this turns each fixable thing into money and a message the
// customer can send their retailer as it is, plus what to tell the Energy and
// Water Ombudsman (EWOV) if the retailer doesn't fix it. No phone numbers are given (5 Nov 2026). Messages are fixed
// templates filled from the bill, never invented: anything we don't know stays
// in [brackets] for the customer to fill in.

/** Victorian Annual Electricity Concession: 17.5% off usage and supply, not on the first $171.60 a year. */
export const VIC_CONCESSION_RATE = 0.175;
export const VIC_CONCESSION_EXCLUDED = 171.6;
export const EWOV_URL = "https://www.ewov.com.au/start-a-complaint";

export type FindingId = "older" | "tariff" | "dearer" | "fees" | "discount" | "unexplained" | "read" | "concession";

export interface FindContext {
  retailer: string;
  /** The plan printed on the bill. */
  billPlanName?: string | null;
  /** Same plan, today's cheaper version; or the retailer's cheapest plan for this usage. */
  olderVersion?: { planName: string; perYear: number } | null;
  retailerBest?: { planName: string; savingPerYear: number } | null;
  worthPerYear: number;
  /** Ids the bill check flagged (act or look level). */
  flagged: Set<string>;
  readingType?: "actual" | "estimated" | "mixed" | null;
  concessionApplied?: boolean;
  /** Has a Pensioner, Health Care or DVA Gold card: true, false, or not asked yet. */
  hasCard?: boolean | null;
  fees?: BillFee[];
  /** This bill's charges, and the days it covers (for yearly figures). */
  billTotal?: number | null;
  days?: number | null;
  unexplained?: number | null;
  name?: string | null;
  address?: string | null;
  nmi?: string | null;
  fuel?: "electricity" | "gas";
}

export interface Finding {
  id: FindingId;
  /** What it's worth: a yearly figure, a one-off refund, or null when it can't be priced. */
  perYear: number | null;
  oneOff: number | null;
  /** One line: what to ask for. */
  ask: string;
  /** 5 Nov 2026: what to say to the retailer (in their app, chat or on the phone), in two or three short sentences. */
  say: string;
  message: { subject: string; body: string };
  /** What to tell EWOV if the retailer doesn't fix it within two weeks. */
  ewov: string;
}

const money = (n: number) => "$" + n.toFixed(2);
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

/** Yearly value of the concession on a bill of this size. */
export function concessionPerYear(billTotal: number | null | undefined, days: number | null | undefined): number | null {
  if (!billTotal || !days || billTotal <= 0 || days <= 0) return null;
  const year = (billTotal * 365) / days;
  return Math.max(0, Math.round((year - VIC_CONCESSION_EXCLUDED) * VIC_CONCESSION_RATE));
}

function letter(c: FindContext, subject: string, request: string): { subject: string; body: string } {
  const who = c.retailer || "there";
  const acct = [c.address ? `for ${c.address}` : null, c.nmi ? `(NMI ${c.nmi})` : null].filter(Boolean).join(" ");
  return {
    subject,
    body: [
      `Hi ${who},`,
      "",
      `I'm writing about my ${c.fuel === "gas" ? "gas" : "electricity"} account${acct ? ` ${acct}` : ""}. My account number is [your account number].`,
      "",
      request,
      "",
      "Please confirm by email once it's done.",
      "",
      "Thanks,",
      c.name?.trim() || "[your name]",
    ].join("\n"),
  };
}

function ewov(c: FindContext, about: string, want: string): string {
  return [
    `I contacted ${c.retailer || "my retailer"} on [date] about ${about}. It hasn't been fixed.`,
    `Account: [your account number]${c.nmi ? `, NMI ${c.nmi}` : ""}${c.address ? `, ${c.address}` : ""}.`,
    `I'm asking for ${want}.`,
  ].join("\n");
}

/** Everything on this bill that money can be recovered from or saved on, most valuable first. */
export function findMoney(c: FindContext): { findings: Finding[]; perYear: number; oneOff: number } {
  const out: Finding[] = [];
  const who = c.retailer || "your retailer";

  if (c.olderVersion && c.olderVersion.perYear >= c.worthPerYear) {
    const plan = c.olderVersion.planName;
    out.push({
      id: "older", perYear: Math.round(c.olderVersion.perYear), oneOff: null,
      ask: `Ask ${who} to move you to the current “${plan}”. Same company, no switch.`,
      say: `I'm on “${c.billPlanName ?? "an older plan"}”. Your current “${plan}” is cheaper for my usage. Can you move me to it from my next bill, with no exit fee?`,
      message: letter(c, `Please move me to your current ${plan}`,
        `My bill shows I'm on “${c.billPlanName ?? "an older plan"}”. Your current “${plan}” is cheaper for my usage. Please move me to it from my next bill, with no exit fee, and confirm the new rates in writing.`),
      ewov: ewov(c, "moving to their current version of my plan", `to be moved to “${plan}” and the difference refunded from the date I asked`),
    });
  } else if (c.retailerBest && c.retailerBest.savingPerYear >= c.worthPerYear && c.flagged.has("tariff")) {
    const plan = c.retailerBest.planName;
    out.push({
      id: "tariff", perYear: Math.round(c.retailerBest.savingPerYear), oneOff: null,
      ask: `Ask ${who} to move you to “${plan}”. Same company, no switch.`,
      say: `I'd like to move to your “${plan}” plan; it's cheaper for my usage. Can you move me from my next bill, with no exit fee, and email me the Energy Fact Sheet?`,
      message: letter(c, `Please move me to ${plan}`,
        `I'd like to move to your “${plan}” plan, which works out cheaper for my usage than my current plan${c.billPlanName ? ` (“${c.billPlanName}”)` : ""}. Please move me from my next bill, with no exit fee, and send me the new plan's Energy Fact Sheet.`),
      ewov: ewov(c, `moving to their cheaper “${plan}” plan`, `to be moved to “${plan}” from the date I asked`),
    });
  }

  if (c.flagged.has("dearer")) {
    out.push({
      id: "dearer", perYear: null, oneOff: null,
      ask: `Ask ${who} why your rates are higher than any plan on sale, and to move you to a current plan.`,
      say: `My rates are higher than any plan you sell today. Can you check I'm on the right plan and move me to your best current plan for my usage?`,
      message: letter(c, "My rates are higher than any plan you sell today",
        `The rates on my latest bill are higher than any plan on sale on my network today. Please check I'm on the right plan and tariff, and move me to your best current plan for my usage. If I've been charged the wrong rates, please refund the difference.`),
      ewov: ewov(c, "rates higher than any plan on sale", "a review of my plan and tariff, and a refund if the rates were wrong"),
    });
  }

  if (c.hasCard === true && !c.concessionApplied && c.fuel !== "gas") {
    const est = concessionPerYear(c.billTotal, c.days);
    out.push({
      id: "concession", perYear: est, oneOff: null,
      ask: `Ask ${who} to add the Victorian annual electricity concession (17.5% off). It isn't automatic.`,
      say: `I have a concession card and it isn't on my account. Can you add the Victorian electricity concession, and the winter gas concession if you supply my gas? And can it apply to my current bill?`,
      message: letter(c, "Please add my energy concession",
        `I hold a [Pensioner Concession / Health Care / DVA Gold] card, number [card number], in the account holder's name. Please add the Victorian Annual Electricity Concession to my account, and the Winter Gas Concession if you also supply my gas. Please also tell me whether it can be applied to my current bill.`),
      ewov: ewov(c, "adding my energy concession", "the concession applied from the date I gave my card details"),
    });
  }

  const waivable = (c.fees ?? []).filter((f) => f.amount > 0 && (f.kind === "late_payment" || f.kind === "reconnection"));
  if (waivable.length) {
    const total = waivable.reduce((t, f) => t + f.amount, 0);
    const what = waivable.map((f) => `${money(f.amount)} ${f.kind === "late_payment" ? "late-payment fee" : "reconnection fee"}`).join(" and ");
    out.push({
      id: "fees", perYear: null, oneOff: Math.round(total * 100) / 100,
      ask: `Ask ${who} to waive the ${what}. Retailers often do, once.`,
      say: `My last bill has a ${what}. Could you waive it as a one-off? I've set up a reminder so it won't happen again.`,
      message: letter(c, "Please waive a fee on my bill",
        `My latest bill includes a ${what}. Please waive it as a one-off. I've set up [direct debit / a payment reminder] so it won't happen again.`),
      ewov: ewov(c, `a ${what}`, "the fee removed"),
    });
  }

  if (c.flagged.has("discount")) {
    out.push({
      id: "discount", perYear: null, oneOff: null,
      ask: `If you paid on time, ask ${who} to apply the discount you missed.`,
      say: `My pay-on-time discount wasn't applied on my last bill, but I paid on time. Can you apply it and credit my account?`,
      message: letter(c, "My pay-on-time discount wasn't applied",
        `My latest bill shows my pay-on-time (conditional) discount wasn't applied. I paid [amount] on [date], on or before the due date. Please apply the discount and credit it to my account.`),
      ewov: ewov(c, "a pay-on-time discount that wasn't applied although I paid on time", "the discount credited to my account"),
    });
  }

  if (c.flagged.has("unexplained") && c.unexplained && c.unexplained > 0) {
    out.push({
      id: "unexplained", perYear: null, oneOff: null,
      ask: `Ask ${who} to explain about ${whole(c.unexplained)} of charges that your usage doesn't account for.`,
      say: `My bill is about ${whole(c.unexplained)} more than my usage and rates add up to. Can you go through the charges with me and fix anything that's wrong?`,
      message: letter(c, "Please explain some charges on my bill",
        `My usage and rates come to less than my latest bill by about ${whole(c.unexplained)}. Please send me an itemised breakdown of every charge on this bill, and correct anything charged in error.`),
      ewov: ewov(c, `about ${whole(c.unexplained)} of charges they couldn't explain`, "an itemised explanation and a refund of anything charged in error"),
    });
  }

  if (c.readingType === "estimated" || c.readingType === "mixed") {
    out.push({
      id: "read", perYear: null, oneOff: null,
      ask: `Ask ${who} for an actual meter read, or send them a photo of your meter.`,
      say: `My last bill used an estimated read. Can you arrange an actual read and re-issue the bill if it changes? I can send a photo of my meter.`,
      message: letter(c, "My bill used an estimated meter read",
        `My latest bill is based on an estimated read. Please arrange an actual read and re-issue the bill if it changes. I've attached a photo of my meter showing [reading] on [date].`),
      ewov: ewov(c, "a bill based on an estimated read", "a bill based on an actual read, and any overcharge refunded"),
    });
  }

  const perYear = out.reduce((t, f) => t + (f.perYear ?? 0), 0);
  const oneOff = out.reduce((t, f) => t + (f.oneOff ?? 0), 0);
  return { findings: out, perYear, oneOff: Math.round(oneOff * 100) / 100 };
}
