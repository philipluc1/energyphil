// Google reviews (2 Nov 2026). We ask every member in the same situation, the
// same way, whatever we think they'd say (no "review gating"), and never offer
// anything for a review: Google bans both and the ACCC treats them as misleading.
// Links go through /api/review so the owner dashboard can count clicks; Google
// doesn't tell us who actually left a review.

export const REVIEW_SOURCES = ["switched", "member", "reminder", "recap", "dashboard"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** The Google "Ask for reviews" link, set in Vercel as NEXT_PUBLIC_GOOGLE_REVIEW_URL. Null until it's set. */
export function reviewUrl(): string | null {
  const u = (process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? "").trim();
  return /^https:\/\/[^\s]+$/.test(u) ? u : null;
}

/** Our tracked link: counts the click, then sends them to Google. */
export const trackedReviewLink = (origin: string, subscriberId: string | null, src: ReviewSource) =>
  `${origin}/api/review?src=${src}${subscriberId ? `&id=${subscriberId}` : ""}`;

export const REVIEW_AFTER_SWITCH_DAYS = 21;
export const REVIEW_AFTER_JOIN_DAYS = 45;
export const REVIEW_REMINDER_DAYS = 7;

const days = (from: string | null | undefined, now: number) => (from ? (now - Date.parse(from)) / 86_400_000 : -1);

/**
 * Which review email is due today, if any:
 * - "switched": 3 weeks after they told us they switched (the main ask);
 * - "member": 45 days after joining, for members who haven't switched;
 * - "reminder": once, a week after the first ask, if they didn't click.
 * Never after a click, never more than twice, never to anyone cancelling,
 * behind on payments or unsubscribed.
 */
export function reviewAskDue(o: {
  status: string;
  cancelAt: string | null;
  unsubscribed: boolean;
  createdAt: string;
  switchedAt: string | null;
  asks: number;
  askedAt: string | null;
  clickedAt: string | null;
  now: number;
}): "switched" | "member" | "reminder" | null {
  if (o.status !== "active" || o.cancelAt || o.unsubscribed || o.clickedAt) return null;
  if (o.asks >= 2) return null;
  if (o.asks === 1) return days(o.askedAt, o.now) >= REVIEW_REMINDER_DAYS ? "reminder" : null;
  if (o.switchedAt) return days(o.switchedAt, o.now) >= REVIEW_AFTER_SWITCH_DAYS ? "switched" : null;
  return days(o.createdAt, o.now) >= REVIEW_AFTER_JOIN_DAYS ? "member" : null;
}
