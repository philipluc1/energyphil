import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { parseTestimonial } from "@/lib/testimonials";

// Owner dashboard (12 Nov 2026): add a real review to the home page, hide or
// show one, or delete it. The home page updates straight away.

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = (m: string) => (/does not exist|schema cache/i.test(m) ? "Run the latest SQL in Supabase first (adds the testimonials table)." : m);

async function guard(req: NextRequest) {
  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) return fail("Please log in to the dashboard again.", 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail("Not allowed.", 403);
  if (!supabaseAdmin) return fail("The database isn't connected.", 500);
  return null;
}

export async function POST(req: NextRequest) {
  const no = await guard(req); if (no) return no;
  const p = parseTestimonial(await req.json().catch(() => null));
  if (!p.ok) return fail(p.message);
  let { error } = await supabaseAdmin!.from("testimonials").insert({ ...p.value, shown: true, approved_at: new Date().toISOString() });
  if (error && /column/i.test(error.message)) ({ error } = await supabaseAdmin!.from("testimonials").insert({ ...p.value, shown: true }));
  if (error) return fail(missing(error.message), 500);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const no = await guard(req); if (no) return no;
  const b = await req.json().catch(() => null);
  if (!UUID.test(String(b?.id ?? "")) || typeof b?.shown !== "boolean") return fail("Bad request.");
  let { error } = await supabaseAdmin!.from("testimonials").update(b.shown ? { shown: true, approved_at: new Date().toISOString() } : { shown: false }).eq("id", b.id);
  if (error && /column/i.test(error.message)) ({ error } = await supabaseAdmin!.from("testimonials").update({ shown: b.shown }).eq("id", b.id));
  if (error) return fail(missing(error.message), 500);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const no = await guard(req); if (no) return no;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return fail("Bad request.");
  const { error } = await supabaseAdmin!.from("testimonials").delete().eq("id", id);
  if (error) return fail(missing(error.message), 500);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
