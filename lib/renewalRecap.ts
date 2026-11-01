// The yearly recap (2 Nov 2026): two weeks before a membership renews, what
// Utilo did for them that year, in their own numbers. Plain maths here so it
// can be tested; the email wording is in emailTemplates.ts.

export const RECAP_DAYS_BEFORE = 14;
/** Plans that renew on a long cycle get a recap; monthly doesn't (it would be every month). */
export const RECAP_PLANS = new Set(["annual", "half_yearly", "quarterly"]);

const DAY = 86_400_000;

export interface Episode { started_at: string; ended_at: string | null; daily_rate: number }

/** Saved since they switched: each savings episode's daily rate over the days it ran, from the switch date on. */
export function savedSince(episodes: Episode[], switchedAt: string | null, now: Date = new Date()): number {
  if (!switchedAt) return 0;
  const from = Date.parse(switchedAt);
  let total = 0;
  for (const e of episodes) {
    const start = Math.max(Date.parse(e.started_at), from);
    const end = e.ended_at ? Date.parse(e.ended_at) : now.getTime();
    if (end > start && e.daily_rate > 0) total += ((end - start) / DAY) * e.daily_rate;
  }
  return Math.round(total * 100) / 100;
}

/** Is this the day to send the recap for this renewal? (Run daily: a 2-day window so a missed run still catches it.) */
export function recapDue(o: { plan: string; status: string; periodEnd: string | null; sentFor: string | null; now?: Date }): boolean {
  if (!RECAP_PLANS.has(o.plan) || o.status !== "active" || !o.periodEnd) return false;
  const now = (o.now ?? new Date()).getTime();
  const end = Date.parse(o.periodEnd);
  const days = (end - now) / DAY;
  if (days > RECAP_DAYS_BEFORE || days < RECAP_DAYS_BEFORE - 2) return false;
  return o.sentFor !== o.periodEnd.slice(0, 10);
}

/** Days they've been watched this membership year (since the later of joining and a year before renewal). */
export function daysWatched(createdAt: string, periodEnd: string, now: Date = new Date()): number {
  const start = Math.max(Date.parse(createdAt), Date.parse(periodEnd) - 365 * DAY);
  return Math.max(1, Math.round((now.getTime() - start) / DAY));
}
