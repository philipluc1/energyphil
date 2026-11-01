import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Owner dashboard: member management helpers (2 Nov 2026). Server only; every
// caller has already checked the dashboard password cookie.

/** Every table that holds a person's data under their email address. */
export const EMAIL_TABLES = ["leads", "bill_checks", "bills", "bill_reads", "savings_episodes", "waitlist", "push_subscriptions", "subscribers"] as const;

/** Fields the owner can edit on a member, with how to clean each value. */
export const EDITABLE: Record<string, (v: unknown) => { ok: true; value: unknown } | { ok: false; message: string }> = {
  customer_name: (v) => text(v, 80),
  address: (v) => text(v, 160),
  suburb: (v) => text(v, 60),
  postcode: (v) => {
    if (v === null || v === "") return { ok: true, value: null };
    return typeof v === "string" && /^\d{4}$/.test(v.trim()) ? { ok: true, value: v.trim() } : { ok: false, message: "Postcode must be 4 digits." };
  },
  current_retailer: (v) => text(v, 60),
  current_plan_name: (v) => text(v, 120),
  unsubscribed: (v) => (typeof v === "boolean" ? { ok: true, value: v } : { ok: false, message: "Bad value." }),
  monthly_summary: (v) => (typeof v === "boolean" ? { ok: true, value: v } : { ok: false, message: "Bad value." }),
  alert_min_saving: (v) => {
    if (v === null || v === "") return { ok: true, value: null };
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 5000 ? { ok: true, value: Math.round(n) } : { ok: false, message: "Alert minimum must be between $0 and $5,000." };
  },
};

function text(v: unknown, max: number): { ok: true; value: string | null } | { ok: false; message: string } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, message: "Bad value." };
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length > max) return { ok: false, message: `Keep it under ${max} characters.` };
  return { ok: true, value: t || null };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The sign-in account for an email, if there is one. */
export async function findAuthUser(db: SupabaseClient, email: string): Promise<{ id: string } | null> {
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === want);
    if (hit) return { id: hit.id };
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Write a line to the admin log; never fails the action if the table is missing. */
export async function logAdmin(db: SupabaseClient, action: string, member: string, detail: Record<string, unknown> = {}) {
  const { error } = await db.from("admin_actions").insert({ action, member, detail });
  if (error && !/does not exist|schema cache/i.test(error.message)) console.error("admin log", error.message);
}

/** All spellings of an email we might have stored (as typed, lower case). */
export async function emailVariants(db: SupabaseClient, email: string): Promise<string[]> {
  const low = email.trim().toLowerCase();
  const { data } = await db.from("subscribers").select("email").ilike("email", low.replace(/[%_\\]/g, "\\$&"));
  return Array.from(new Set([email, low, ...((data ?? []) as { email: string }[]).map((r) => r.email)]));
}
