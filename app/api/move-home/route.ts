import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { VDO } from "@/lib/plans";
import { guessGasZoneFromPostcode } from "@/lib/postcodeGas";

// A member is moving (1 Nov 2026): their new address and network go on their
// record, so every morning's check prices plans for the new home. The old
// meter number (NMI) doesn't move with them, so it's cleared; their usage,
// retailer and rates stay until a bill from the new place replaces them.
// Body: { postcode, suburb?, address?, distributor }
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: NextRequest) {
  const member = await requireActiveMember(req.headers.get("authorization"));
  if (!member.ok) return NextResponse.json({ ok: false, message: member.message }, { status: member.status });
  if (!supabaseAdmin) return NextResponse.json({ ok: false, message: "Not available yet." });
  const b = await req.json().catch(() => null);
  const postcode = typeof b?.postcode === "string" && /^3\d{3}$/.test(b.postcode.trim()) ? b.postcode.trim() : null;
  const distributor = typeof b?.distributor === "string" && b.distributor in VDO ? b.distributor : null;
  if (!postcode || !distributor) return NextResponse.json({ ok: false, message: "Enter a Victorian postcode and pick the network." });

  const { data: sub } = await supabaseAdmin
    .from("subscribers")
    .select("id, gas_zone")
    .eq("email", member.email)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: false, message: "No active membership found." });

  const fields: Record<string, unknown> = {
    postcode,
    suburb: str(b?.suburb, 80),
    address: str(b?.address, 200),
    distributor,
    nmi: null,
  };
  // Gas follows the move when they have gas on file and we know the new gas network.
  const gasZone = guessGasZoneFromPostcode(postcode);
  if (sub.gas_zone && gasZone) fields.gas_zone = gasZone;

  const { error } = await supabaseAdmin.from("subscribers").update(fields).eq("id", sub.id);
  if (error) return NextResponse.json({ ok: false, message: "Couldn't save that. Try again." });
  return NextResponse.json({ ok: true, ...fields });
}
