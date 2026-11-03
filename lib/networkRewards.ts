// What the dashboard's "Discounts and rewards" shows on a network, counted
// (3 Nov 2026, for the second invite email): sign-up credits, points, gift
// cards and % discounts across every electricity plan there.
import { PLANS } from "./plans";
import { extrasFor } from "./planExtras";
import { rewardsIn, type RewardKind } from "./rewards";

export interface NetworkRewards {
  network: string;
  counts: Record<RewardKind, number>;
  /** The biggest sign-up credit in dollars, or null. */
  topCredit: number | null;
  /** Retailers offering at least one. */
  retailers: number;
}

export function networkRewards(network: string): NetworkRewards {
  const counts: Record<RewardKind, number> = { credit: 0, points: 0, gift: 0, discount: 0 };
  const seen = new Set<string>();
  const who = new Set<string>();
  let topCredit: number | null = null;
  for (const p of PLANS) {
    if (p[1] !== network) continue;
    for (const r of rewardsIn(extrasFor("E", p[0], p[2], p[1]))) {
      // One per retailer and offer, however many of its plans carry it.
      const key = `${p[0]}|${r.kind}|${r.headline.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts[r.kind]++;
      who.add(p[0]);
      if (r.kind === "credit" && r.value > 0 && r.value > (topCredit ?? 0)) topCredit = r.value;
    }
  }
  return { network, counts, topCredit, retailers: who.size };
}
