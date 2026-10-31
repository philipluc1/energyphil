import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Deletes everything Utilo holds about the signed-in person: saved checks,
// membership history, savings, bill-read counts, waitlist entries and the
// sign-in account itself. An active membership must be cancelled first, so
// nobody keeps paying for an account that no longer exists. Payment records
// stay with Stripe, which must keep them by law.
const TABLES = ["leads", "bill_checks", "bill_reads", "savings_episodes", "waitlist", "push_subscriptions", "subscribers"] as const;

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Accounts aren't switched on yet." });
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ ok: false, message: "Please log in again." }, { status: 401 });
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;
  const email = user?.email?.toLowerCase();
  if (userErr || !user || !email) return NextResponse.json({ ok: false, message: "Please log in again." }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (b?.confirm !== "DELETE") return NextResponse.json({ ok: false, message: "Please confirm first." }, { status: 400 });

  const { data: live } = await supabaseAdmin.from("subscribers").select("id").eq("email", email).in("status", ["active", "past_due"]).limit(1).maybeSingle();
  if (live) {
    return NextResponse.json({
      ok: false,
      message: "Cancel your membership first (Manage or cancel, above), then come back and delete your data.",
    });
  }

  const failed: string[] = [];
  for (const table of TABLES) {
    // Exact matches only (never a pattern), in lower case and as typed.
    const { error } = await supabaseAdmin.from(table).delete().in("email", Array.from(new Set([email, user.email!])));
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.error(`delete-my-data: ${table}`, error.message);
      failed.push(table);
    }
  }
  if (failed.length) {
    return NextResponse.json({ ok: false, message: "Some of your data couldn't be deleted just now. Please try again, or email us and we'll finish it." }, { status: 500 });
  }
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (delErr) console.error("delete-my-data: auth user", delErr.message);
  return NextResponse.json({ ok: true });
}
