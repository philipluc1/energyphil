// What Utilo noticed on a customer's bill: an estimated read, money owed or a
// payment plan, whether a concession is applied, and the retailer's own
// "best offer" message. Read off the bill, kept with the check (browser) and
// on the member's record (subscribers.bill_check).

export interface BillCheck {
  readingType: "actual" | "estimated" | "mixed" | null;
  /** Overdue amount and payment plan: shown once, at the moment of the check, and never stored (see forStorage). */
  overdue: number | null;
  paymentPlan: boolean;
  concession: boolean;
  bestOffer: { planName: string | null; savingPerYear: number | null; saysOnBest: boolean } | null;
  /** When the bill was read (ISO date). */
  checkedAt?: string | null;
}

const num = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n < max ? Math.round(n * 100) / 100 : null;
};

/** The same check without anything about money owed, for saving anywhere (browser, member record, Stripe). */
export function forStorage(c: BillCheck): BillCheck {
  return { ...c, overdue: null, paymentPlan: false };
}

/** Accept only the shape above (anything from a browser or Stripe metadata is untrusted).
 *  Anything about money owed is dropped: we only use that on screen during the check. */
export function cleanBillCheck(x: unknown): BillCheck | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const reading = r.readingType === "actual" || r.readingType === "estimated" || r.readingType === "mixed" ? r.readingType : null;
  const bo = r.bestOffer && typeof r.bestOffer === "object" ? (r.bestOffer as Record<string, unknown>) : null;
  const bestOffer = bo
    ? {
        planName: typeof bo.planName === "string" ? bo.planName.slice(0, 120) : null,
        savingPerYear: num(bo.savingPerYear, 10000),
        saysOnBest: bo.saysOnBest === true,
      }
    : null;
  const checkedAt = typeof r.checkedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.checkedAt) ? r.checkedAt.slice(0, 10) : null;
  return {
    readingType: reading,
    overdue: null,
    paymentPlan: false,
    concession: r.concession === true,
    bestOffer,
    checkedAt,
  };
}

/** From a freshly read bill. */
export function billCheckFromBill(b: {
  readingType?: BillCheck["readingType"];
  overdueAmount?: number | null;
  paymentPlan?: boolean;
  concessionApplied?: boolean;
  bestOffer?: BillCheck["bestOffer"];
}): BillCheck {
  return {
    readingType: b.readingType ?? null,
    overdue: b.overdueAmount ?? null,
    paymentPlan: b.paymentPlan === true,
    concession: b.concessionApplied === true,
    bestOffer: b.bestOffer ?? null,
    checkedAt: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD in local time
  };
}
