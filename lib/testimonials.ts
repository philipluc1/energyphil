// Reviews on the home page (12 Nov 2026, Phil). Real reviews only, copied word
// for word from Google (or an email a member sent), added by the owner on the
// dashboard. No incentives and no picking only the good ones: the ACCC treats
// both as misleading. The home page shows the newest first and the average of
// everything shown.

export const TESTIMONIAL_SOURCES = ["Utilo", "Google", "Email", "Other"] as const;
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];

export interface Testimonial {
  id: string;
  name: string;
  place?: string | null;
  stars: number;
  body: string;
  source: TestimonialSource | string;
  review_date?: string | null;
  shown?: boolean | null;
  created_at?: string;
  /** Left on the review page and not yet approved (14 Nov 2026). */
  approved_at?: string | null;
  email?: string | null;
}

export interface NewTestimonial { name: string; place: string | null; stars: number; body: string; source: TestimonialSource; review_date: string | null }

/** Checks what the dashboard form sends. */
export function parseTestimonial(b: unknown): { ok: true; value: NewTestimonial } | { ok: false; message: string } {
  const o = (b ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
  const name = s(o.name, 40);
  const place = s(o.place, 40) || null;
  const body = typeof o.body === "string" ? o.body.trim().slice(0, 600) : "";
  const stars = Number(o.stars);
  const source = TESTIMONIAL_SOURCES.find((x) => x === o.source) ?? "Utilo";
  const date = typeof o.review_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.review_date) ? o.review_date : null;
  if (!name) return { ok: false, message: "Add the reviewer's name, as they gave it (e.g. Sarah M.)." };
  if (body.length < 10) return { ok: false, message: "Paste the review, word for word." };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, message: "Pick the stars they gave (1 to 5)." };
  return { ok: true, value: { name, place, stars, body, source, review_date: date } };
}

/** The average shown beside the reviews, one decimal, or null with none. */
export function averageStars(list: Pick<Testimonial, "stars">[]): number | null {
  if (!list.length) return null;
  return Math.round((list.reduce((a, t) => a + t.stars, 0) / list.length) * 10) / 10;
}

/** What someone leaves on the review page (14 Nov 2026). Shown only once the owner approves it. */
export function parseReviewForm(b: unknown): { ok: true; value: NewTestimonial & { email: string | null } } | { ok: false; message: string } {
  const o = (b ?? {}) as Record<string, unknown>;
  if (o.used !== true) return { ok: false, message: "Reviews are for people who've used Utilo: a free check or Utilo Plus." };
  if (o.consent !== true) return { ok: false, message: "Tick the box so we can show your review on our site." };
  const email = typeof o.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email.trim()) ? o.email.trim().toLowerCase().slice(0, 200) : null;
  const p = parseTestimonial({ ...o, source: "Utilo", review_date: new Date().toISOString().slice(0, 10) });
  if (!p.ok) return p.message.startsWith("Add the reviewer") ? { ok: false, message: "Add your first name (and an initial if you like)." } : p.message.startsWith("Paste") ? { ok: false, message: "Write a line or two about how Utilo went for you." } : p;
  return { ok: true, value: { ...p.value, email } };
}
