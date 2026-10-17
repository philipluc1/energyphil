// Is this a normal Victorian home on its own electricity account?
//
// Utilo compares residential market offers. Three kinds of site don't fit and
// would give a misleading result:
//   - businesses (different tariffs, often demand charges, larger usage)
//   - embedded networks (apartments, retirement villages, caravan parks where
//     the building's operator bills you, not a normal retailer)
//   - large sites over the small-customer threshold
// These helpers give early, honest signals. None is perfect, so the UI lets a
// customer say "it's my home" and carry on when a signal is wrong.

import type { Distributor } from "./plans";

/** NMI ranges AEMO allocates to each Victorian distributor (AEMO NMI Allocation List). */
const NMI_RANGES: { from: number; to: number; network: Distributor }[] = [
  { from: 6001000000, to: 6001999999, network: "Jemena" },
  { from: 6102000000, to: 6103999999, network: "Citipower" },
  { from: 6203000000, to: 6204999999, network: "Powercor" },
  { from: 6305000000, to: 6306999999, network: "AusNet Services" },
  { from: 6407000000, to: 6408999999, network: "United Energy" },
];

/** Tidy an NMI as typed or read: digits and letters only, upper case. */
export function cleanNmi(raw: string): string {
  return raw.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export type NmiCheck =
  | { status: "empty" }
  | { status: "incomplete" }
  | { status: "network"; network: Distributor }
  | { status: "notVictorian" };

/**
 * Which network a meter number belongs to. An NMI is 10 characters (11 with
 * the checksum digit on some bills). A complete NMI outside every Victorian
 * distributor's range usually means an embedded network (the building's
 * operator allocates its own meter numbers) or a meter in another state.
 */
export function checkNmi(raw: string): NmiCheck {
  const nmi = cleanNmi(raw);
  if (!nmi) return { status: "empty" };
  if (nmi.length < 10) return { status: "incomplete" };
  const head = nmi.slice(0, 10);
  if (!/^\d{10}$/.test(head)) return { status: "notVictorian" };
  const n = Number(head);
  const hit = NMI_RANGES.find((r) => n >= r.from && n <= r.to);
  return hit ? { status: "network", network: hit.network } : { status: "notVictorian" };
}

/** Victoria's small-customer threshold for electricity: 40 MWh a year. Above it is a large (business) customer. */
export const SMALL_CUSTOMER_KWH_PER_YEAR = 40_000;

export type PropertyType = "home" | "embedded" | "business";

/** Words in an address that suggest a business site or an apartment building. Hints only. */
export function addressHint(address: string): "business" | "apartment" | null {
  const a = ` ${address.toLowerCase()} `;
  if (/\b(warehouse|factory|shop|suite|office|industrial|showroom|depot|pty|ltd|limited|business park|trade centre)\b/.test(a)) return "business";
  if (/\b(apartment|apt|level|lvl|flat|unit)\b/.test(a) || /\b\d+\s*\/\s*\d+/.test(a)) return "apartment";
  return null;
}
