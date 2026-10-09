import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STATES = ["NSW", "SA", "QLD", "Other"];

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  const state = STATES.includes(b?.state) ? (b.state as string) : "Other";
  const postcode = typeof b?.postcode === "string" && /^\d{4}$/.test(b.postcode) ? b.postcode : null;
  if (!email.includes("@")) return NextResponse.json({ ok: false, message: "Enter a valid email." });
  if (!supabaseAdmin) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin.from("waitlist").insert({ email, state, postcode });
  if (error) {
    console.error("waitlist insert failed", error);
    return NextResponse.json({ ok: false, message: "Couldn't save that. Try again." });
  }
  return NextResponse.json({ ok: true });
}
