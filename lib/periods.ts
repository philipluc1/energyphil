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
