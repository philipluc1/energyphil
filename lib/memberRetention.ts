// "Then it's deleted" (Privacy Policy, 4 Nov 2026): an ended membership's data
// is removed PRIVACY.memberRetentionDays after it ends, unless the same email
// has another live membership. Pure, so the rule is tested.

export interface EndedRow {
  status: string;
  canceled_at?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
}

/** When the membership ended: the later of the cancel date and the end of the paid period. */
export function endedAt(r: EndedRow): number | null {
  const t = [r.canceled_at, r.current_period_end].map((x) => (x ? Date.parse(x) : NaN)).filter((x) => Number.isFinite(x));
  return t.length ? Math.max(...t) : null;
}

export function retentionDue(r: EndedRow, opts: { days: number; otherLive: boolean; now?: Date }): boolean {
  if (r.status !== "canceled" || opts.otherLive) return false;
  const end = endedAt(r);
  if (end === null) return false; // no end date on file: never guess
  return (opts.now ?? new Date()).getTime() - end >= opts.days * 86_400_000;
}
