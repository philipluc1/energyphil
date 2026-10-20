/**
 * Each retailer's cheapest plan only. `ranked` is already cheapest first, so
 * the first plan seen for a retailer is its cheapest. `keep` (the cheapest
 * plan you can actually get) always stays, even if a restricted plan from the
 * same retailer ranks above it.
 */
export function cheapestPerRetailer<T extends { plan: readonly unknown[] }>(ranked: T[], keep?: T | null): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  for (const m of ranked) {
    const retailer = m.plan[0];
    if (m === keep || !seen.has(retailer)) out.push(m);
    seen.add(retailer);
  }
  return out;
}
