// Showing a bill's figures "a month", "a quarter" or "a year".
export const PERIOD_DAYS = { month: 365 / 12, quarter: 365 / 4, year: 365 } as const;
export type PeriodName = keyof typeof PERIOD_DAYS;

/**
 * What to multiply a bill-period figure by to show it for `period`. When the
 * bill already covers about that period (a 91-day bill shown "a quarter", a
 * 30-day bill "a month"), it's 1: the bill's own figures, not a rescaled
 * $413.50 next to a $412.37 bill.
 */
export function periodScale(period: PeriodName, days: number): number {
  if (!(days > 0)) return 1;
  const d = PERIOD_DAYS[period];
  return Math.abs(d - days) <= 3 ? 1 : d / days;
}

/**
 * "bill" (2 Nov 2026, Phil): the bill's own period, so "You now" is the dollar
 * figure printed on the bill. Quarterly and yearly are scaled from it.
 */
export type ShowPeriod = PeriodName | "bill";
const LABEL: Record<PeriodName, string> = { month: "a month", quarter: "a quarter", year: "a year" };

/** The period actually shown: "bill" needs a bill with a period; otherwise a month. */
export const showPeriod = (p: ShowPeriod, haveBill: boolean, days: number): ShowPeriod => (p === "bill" && !(haveBill && days > 0) ? "month" : p);
export const showScale = (p: ShowPeriod, days: number): number => (p === "bill" ? 1 : periodScale(p, days));
export const showLabel = (p: ShowPeriod, days: number): string => (p === "bill" ? `for ${days} days` : LABEL[p]);
/** The three tabs: the bill, then a quarter (or a month, if the bill is already about a quarter) and a year. */
export function showOptions(haveBill: boolean, days: number): ShowPeriod[] {
  if (!(haveBill && days > 0)) return ["month", "quarter", "year"];
  return ["bill", Math.abs(days - PERIOD_DAYS.quarter) <= 3 ? "month" : "quarter", "year"];
}
export const showTab = (p: ShowPeriod, days: number): string => (p === "bill" ? `Your bill · ${days} days` : p === "month" ? "Monthly" : p === "quarter" ? "Quarterly" : "Yearly");
