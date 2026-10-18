// Is the plan named on a bill the same product as one a retailer sells today?
// Retailers reuse names: a customer can be on an older, dearer version of
// "Saver Plus" while today's "Saver Plus" costs less (the ESC counts about
// 360,000 Victorians in this spot). We match on the words of the plan name,
// ignoring the retailer's own name and filler words.

const FILLER = new Set(["plan", "the", "and", "with", "for", "residential", "home", "energy", "electricity", "power", "offer", "market", "vic", "victoria"]);

function words(s: string, drop: Set<string>): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !FILLER.has(w) && !drop.has(w));
}

/** True when nearly every word of the bill's plan name appears in the published plan name. */
export function samePlanName(billPlan: string, publishedPlan: string, retailer: string): boolean {
  const drop = new Set(words(retailer, new Set()));
  const a = words(billPlan, drop);
  if (a.length === 0) return false;
  const b = new Set(words(publishedPlan, drop));
  const hit = a.filter((w) => b.has(w)).length;
  return hit >= Math.min(2, a.length) && hit / a.length >= 0.8;
}
