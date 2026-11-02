// The cancellation email (2 Nov 2026): who gets which one, and only once.
// The decision is a pure function so it can be tested; the webhook does the sending.

export type CancelKind = "scheduled" | "ended";

export interface CancelDecision {
  send: CancelKind | null;
  /** What to store in subscribers.cancel_email_for after sending. */
  key: string | null;
  /** They took the cancellation back: clear the marker so a later cancel gets its own email. */
  reset: boolean;
}

/**
 * - Cancelled for the end of the period (still active, with an end date): "scheduled", once per end date.
 * - Took it back (active, no end date, after a "scheduled" email): reset.
 * - Ended (status cancelled) without a "scheduled" email first: "ended", once.
 * - Another active membership under the same email (a refunded duplicate, a replaced plan): nothing.
 */
export function decideCancelEmail(o: { status: string; cancelAt: string | null; sentFor: string | null; otherActive: boolean }): CancelDecision {
  const none: CancelDecision = { send: null, key: null, reset: false };
  if (o.otherActive) return none;
  if (o.status === "active") {
    if (o.cancelAt) {
      const key = `s:${o.cancelAt.slice(0, 10)}`;
      return o.sentFor === key ? none : { send: "scheduled", key, reset: false };
    }
    return o.sentFor?.startsWith("s:") ? { send: null, key: null, reset: true } : none;
  }
  if (o.status === "canceled") {
    return o.sentFor ? none : { send: "ended", key: "e:1", reset: false };
  }
  return none;
}

/** "16 November 2026", in Melbourne. */
export const endsOnLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" });
