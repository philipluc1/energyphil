// The free bill-photo allowance (1 Nov 2026), as plain rules so they can be
// tested: one free read per fuel on a device with no email; with an email,
// one per fuel every 3 months. A page or retry within 30 minutes of a read
// is part of the same sitting and isn't counted.

export const FREE_DEVICE_DAYS = 365;
export const FREE_EMAIL_DAYS = 91;
export const SAME_SESSION_MIN = 30;
/** One email can't be cycled on one device forever: at most this many counted reads per device per 3 months. */
export const MAX_DEVICE_READS_PER_QUARTER = 4;

export type ReadFuel = "electricity" | "gas" | "dual";
export interface PriorRead { fuel: string | null; created_at: string }

export const covers = (f: string | null | undefined): ("electricity" | "gas")[] =>
  f === "dual" ? ["electricity", "gas"] : f === "electricity" || f === "gas" ? [f] : [];

/** Before reading: is this a retry in the same sitting, and if not, is there any free read left at all? */
export function beforeRead(o: { priors: PriorRead[]; deviceReads: PriorRead[]; hasEmail: boolean; now?: number }):
  { sameSession: boolean; block: null | "needEmail" | "quota" } {
  const now = o.now ?? Date.now();
  const sameSession = [...o.priors, ...o.deviceReads].some((r) => now - Date.parse(r.created_at) < SAME_SESSION_MIN * 60_000);
  if (sameSession) return { sameSession, block: null };
  const used = new Set(o.priors.flatMap((r) => covers(r.fuel)));
  if (used.has("electricity") && used.has("gas")) return { sameSession, block: o.hasEmail ? "quota" : "needEmail" };
  if (o.hasEmail && o.deviceReads.length >= MAX_DEVICE_READS_PER_QUARTER) return { sameSession, block: "quota" };
  return { sameSession, block: null };
}

/** After reading: did every fuel on this bill already have its free read? */
export function afterRead(o: { priors: PriorRead[]; fuel: ReadFuel; sameSession: boolean; hasEmail: boolean }): null | "needEmail" | "quota" {
  if (o.sameSession) return null;
  const used = new Set(o.priors.flatMap((r) => covers(r.fuel)));
  return covers(o.fuel).every((f) => used.has(f)) ? (o.hasEmail ? "quota" : "needEmail") : null;
}

/** When the next free read for this fuel comes round (3 months after the earliest one in the window). */
export function nextFreeDate(priors: PriorRead[], fuel?: ReadFuel): Date | null {
  const relevant = priors.filter((r) => !fuel || covers(r.fuel).some((f) => covers(fuel).includes(f)));
  const first = relevant.map((r) => Date.parse(r.created_at)).sort((a, b) => a - b)[0];
  return first ? new Date(first + FREE_EMAIL_DAYS * 86_400_000) : null;
}
