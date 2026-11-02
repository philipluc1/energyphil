// "Remind me" by email (2 Nov 2026). A member picks a day; the daily morning job
// (recheck-prices, about 6am Melbourne) emails them that day with the plan, the
// retailer's link and their NMI, then forgets the reminder. One at a time.

export interface ReminderNote {
  retailer: string;
  plan: string;
  savingYear: number;
  /** The plan is with the retailer they're already with: a plan change, not a switch. */
  same: boolean;
}

/** Today's date in Melbourne, "2026-11-02". */
export function melbourneDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const MAX_DAYS_AHEAD = 120;

/** A day from today (Melbourne) up to about four months out, or null. */
export function cleanRemindDate(v: unknown, now: Date = new Date()): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) return null;
  const today = Date.parse(`${melbourneDay(now)}T00:00:00Z`);
  const ahead = (t - today) / 86_400_000;
  return ahead >= 0 && ahead <= MAX_DAYS_AHEAD ? v : null;
}

/** Due on the day, or any day after (a missed run still sends it). */
export function reminderDue(remindOn: string | null | undefined, now: Date = new Date()): boolean {
  return !!remindOn && /^\d{4}-\d{2}-\d{2}/.test(remindOn) && remindOn.slice(0, 10) <= melbourneDay(now);
}

/** What the member was shown when they asked, kept with the reminder. */
export function cleanNote(v: unknown): ReminderNote | null {
  const o = v as Partial<ReminderNote> | null;
  if (!o || typeof o !== "object") return null;
  const retailer = typeof o.retailer === "string" ? o.retailer.trim().slice(0, 80) : "";
  const plan = typeof o.plan === "string" ? o.plan.trim().slice(0, 120) : "";
  const savingYear = typeof o.savingYear === "number" && Number.isFinite(o.savingYear) ? Math.max(0, Math.min(10_000, Math.round(o.savingYear))) : 0;
  if (!retailer || !plan) return null;
  return { retailer, plan, savingYear, same: o.same === true };
}

/** "Saturday 7 November" */
export function remindDayLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
