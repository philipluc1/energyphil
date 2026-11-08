// One-line lessons (8 Nov 2026): one plain sentence per email, built from the
// person's own bill. The research (ECA, AER) says generic explainers don't
// move people; their own numbers, the day the bill lands, do. So no glossary:
// the single most useful thing their bill shows, in their dollars.

export interface LessonInput {
  fuel: "electricity" | "gas";
  days: number | null;
  /** kWh (electricity) or MJ (gas) for the period. */
  usage: number | null;
  /** Supply charge, $ a day including GST. */
  supplyPerDay: number | null;
  /** This fuel's charges for the period, $. */
  total: number | null;
  estimated: boolean;
  fees: { kind: string; amount: number }[];
  discountLost: boolean;
}

export interface Lesson {
  key: "estimated" | "fee" | "discount" | "supply" | "usage-high" | "usage-low";
  text: string;
}

/** The Essential Services Commission's standard Victorian home: 4,000 kWh a year. */
export const STANDARD_HOME_KWH_YEAR = 4000;

const dollars = (n: number) => "$" + (Math.round(n * 100) / 100).toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const whole = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
const perDay = (n: number) => (n < 1 ? `${Math.round(n * 100)}c` : dollars(n));
const FEE_WORDS: Record<string, string> = { late_payment: "late fee", paper_bill: "paper-bill fee", payment_processing: "card fee", reconnection: "reconnection fee", other: "fee" };

export function billLesson(i: LessonInput): Lesson | null {
  const word = i.fuel === "gas" ? "gas" : "power";
  if (i.estimated) {
    return { key: "estimated", text: `This ${word} bill used an estimated meter read (often marked “E”), so the next one may go up or down to catch up once the meter is actually read.` };
  }
  const fee = [...i.fees].filter((f) => f.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  if (fee) {
    return { key: "fee", text: `The ${dollars(fee.amount)} ${FEE_WORDS[fee.kind] ?? "fee"} isn't part of your plan's price, and it's worth asking your retailer to take it off.` };
  }
  if (i.discountLost) {
    return { key: "discount", text: `The pay-on-time discount didn't apply this time, so this bill is dearer than your plan's usual price. Paying by the due date brings it back.` };
  }
  const days = i.days && i.days > 0 ? i.days : null;
  const supply = i.supplyPerDay && i.supplyPerDay > 0.1 && i.supplyPerDay < 5 ? i.supplyPerDay : null;
  // The supply charge first when it's a big slice of the bill: it's the part people don't know they pay.
  if (supply && days && i.total && i.total > 0) {
    const share = (supply * days) / i.total;
    if (share >= 0.25 && share < 1) {
      return {
        key: "supply",
        text: i.fuel === "gas"
          ? `Your gas supply charge is ${perDay(supply)} a day: about ${whole(supply * 365)} a year, even in summer when the heater's off.`
          : `Your supply charge is ${perDay(supply)} a day: about ${whole(supply * 365)} a year before you switch a single light on.`,
      };
    }
  }
  if (i.fuel === "electricity" && days && i.usage && i.usage > 0) {
    const daily = i.usage / days;
    const std = STANDARD_HOME_KWH_YEAR / 365;
    const r = daily / std;
    if (r >= 1.25) return { key: "usage-high", text: `You used ${daily.toFixed(1)} kWh a day. The standard Victorian home the regulator prices on uses about ${std.toFixed(0)}, so usage, not just price, is driving this bill.` };
    if (r <= 0.75) return { key: "usage-low", text: `You used ${daily.toFixed(1)} kWh a day, well under the ${std.toFixed(0)} of the standard Victorian home, so the daily supply charge is a bigger share of your bill than most.` };
  }
  if (supply) {
    return {
      key: "supply",
      text: i.fuel === "gas"
        ? `Your gas supply charge is ${perDay(supply)} a day: about ${whole(supply * 365)} a year, whatever you use.`
        : `Your supply charge is ${perDay(supply)} a day: about ${whole(supply * 365)} a year, whatever you use.`,
    };
  }
  return null;
}

/** The lesson for one fuel of a bill read (an ExtractedBill, kept loose so any caller can pass one). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lessonFromBill(b: any, fuel: "electricity" | "gas", skip: Lesson["key"][] = []): Lesson | null {
  if (!b || typeof b !== "object") return null;
  // Leave out what the rest of the email already says (e.g. the money finder covers fees and estimated reads).
  if (skip.length) {
    const quiet = { ...b, readingType: skip.includes("estimated") ? "actual" : b.readingType, usageEstimated: skip.includes("estimated") ? false : b.usageEstimated, fees: skip.includes("fee") ? [] : b.fees, discountLost: skip.includes("discount") ? false : b.discountLost };
    return lessonFromBill(quiet, fuel);
  }
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  if (fuel === "gas") {
    const supplyC = n(b.gasSupplyCentsPerDay);
    return billLesson({
      fuel, days: n(b.gasBillingDays) ?? n(b.billingDays), usage: n(b.gasMj),
      supplyPerDay: supplyC !== null ? supplyC / 100 : null, total: n(b.gasBillTotal),
      // The read type on the bill is the electricity meter's; only trust it on a gas-only bill.
      estimated: b.fuel === "gas" && (b.usageEstimated === true || b.readingType === "estimated"),
      fees: b.fuel === "gas" && Array.isArray(b.fees) ? b.fees : [], discountLost: b.fuel === "gas" && b.discountLost === true,
    });
  }
  const kwh = ["anytimeKwh", "peakKwh", "shoulderKwh", "offpeakKwh", "controlledLoadKwh"].map((k) => n(b[k]) ?? 0).reduce((a, x) => a + x, 0);
  return billLesson({
    fuel, days: n(b.billingDays), usage: kwh > 0 ? kwh : null,
    supplyPerDay: n(b.currentRates?.supply), total: n(b.currentBill),
    estimated: b.readingType === "estimated" || b.readingType === "mixed",
    fees: Array.isArray(b.fees) ? b.fees : [], discountLost: b.discountLost === true,
  });
}
