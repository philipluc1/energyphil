import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export type MemberCheck = { ok: true; email: string } | { ok: false; status: number; message: string };

/**
 * Server-side gate for paid features (bill photo/PDF reading, which costs us
 * an AI call each time). Verifies the Supabase login token, then checks the
 * person has an active subscription. Never trust a client-side flag for this.
 */
export async function requireActiveMember(authHeader: string | null): Promise<MemberCheck> {
  if (!supabaseAdmin) {
    return { ok: false, status: 200, message: "Accounts aren't switched on yet." };
  }
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, message: "Log in to a member account to read bills." };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) {
    return { ok: false, status: 401, message: "Please log in again." };
  }
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscribers")
    .select("id")
    .eq("email", email)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (subErr) {
    console.error("requireActiveMember: lookup failed", subErr);
    return { ok: false, status: 500, message: "Something went wrong — please try again." };
  }
  if (!sub) {
    return { ok: false, status: 403, message: "Bill reading is for members. You can still use the free manual check." };
  }
  return { ok: true, email };
}
