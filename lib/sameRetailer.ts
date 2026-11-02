// "Same retailer, different plan" (2 Nov 2026, Phil: "it looks confusing, like
// I'm on that retailer already"). When the cheapest plan is with the company the
// customer already pays, we say so plainly: no switching, just ask for the plan.

const CORPORATE = new Set(["pty", "ltd", "limited", "the", "co", "inc"]);
const GENERIC = new Set(["energy", "power", "electricity", "retail", "group", "and"]);

/** "Tango Energy", "TANGO", "Tango Energy Pty Ltd" all read as "tango"; "Energy Australia" as "energyaustralia". */
function keys(name: string | null | undefined): { full: string; core: string } {
  const words = (name ?? "").toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter((w) => w && !CORPORATE.has(w));
  const full = words.join("");
  const core = words.filter((w) => !GENERIC.has(w)).join("");
  return { full, core };
}

export function retailerKey(name: string | null | undefined): string {
  const k = keys(name);
  return k.core || k.full;
}

/** True when both name the same retailer (and both are known). */
export function sameRetailer(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = keys(a);
  const kb = keys(b);
  if (ka.full.length < 2 || kb.full.length < 2) return false;
  return ka.full === kb.full || (ka.core.length >= 2 && ka.core === kb.core);
}
