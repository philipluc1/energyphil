// One pick per member (2 Nov 2026). The plan we recommend stays the same
// everywhere (dashboard, alerts, monthly email, phone) until something real
// happens: another plan beats it by the switching threshold, or it's no longer
// on sale. Plans within a hair of it are shown as near-ties, not as a new
// "cheapest" that swaps every few days.

import { WORTH_SWITCHING_PER_YEAR } from "./dataPolicy";

/** Plans this close (dollars a year) count as a tie with the pick. */
export const NEAR_TIE_PER_YEAR = 20;

type Ranked = { plan: readonly unknown[]; total: number; restricted: string | null };

export type PickReason = "first" | "kept" | "cheaper" | "gone";

export interface PickResult<T extends Ranked> {
  pick: T;
  reason: PickReason;
  /** The cheapest plan anyone can get today (may be a near-tie of the pick). */
  cheapest: T;
  /** Other retailers within NEAR_TIE_PER_YEAR of the pick, cheapest first (at most 3). */
  nearTies: T[];
}

const same = (m: Ranked, retailer: string | null | undefined, plan: string | null | undefined) => !!retailer && !!plan && m.plan[0] === retailer && m.plan[2] === plan;

/**
 * Keep the stored pick unless today's cheapest beats it by `worthPerYear` or
 * more, or it can't be had any more. `ranked` is today's ranking, cheapest first.
 */
export function stickyPick<T extends Ranked>(
  ranked: T[],
  stored: { retailer: string | null; plan: string | null } | null,
  days: number,
  worthPerYear: number = WORTH_SWITCHING_PER_YEAR,
): PickResult<T> | null {
  const open = ranked.filter((m) => !m.restricted);
  const cheapest = open[0];
  if (!cheapest || !(days > 0)) return null;
  const perYear = (d: number) => (d * 365) / days;
  let pick = cheapest;
  let reason: PickReason = "first";
  if (stored?.retailer && stored.plan) {
    const kept = open.find((m) => same(m, stored.retailer, stored.plan));
    if (!kept) reason = "gone";
    else if (perYear(kept.total - cheapest.total) >= worthPerYear) reason = "cheaper";
    else {
      pick = kept;
      reason = "kept";
    }
  }
  const seen = new Set<unknown>([pick.plan[0]]);
  const nearTies: T[] = [];
  for (const m of open) {
    if (nearTies.length >= 3) break;
    if (seen.has(m.plan[0])) continue;
    if (Math.abs(perYear(m.total - pick.total)) <= NEAR_TIE_PER_YEAR) {
      nearTies.push(m);
      seen.add(m.plan[0]);
    }
  }
  return { pick, reason, cheapest, nearTies };
}

/** "1st Energy and Sumo", "1st Energy, Sumo and OVO Energy". */
export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
