import { NextRequest, NextResponse } from "next/server";
import { requireActiveMember } from "@/lib/memberAccess";

// Tiny helper so the UI can show or hide the bill-upload card. Not a security
// boundary — /api/extract-bill enforces membership itself.
export async function GET(req: NextRequest) {
  const m = await requireActiveMember(req.headers.get("authorization"));
  return NextResponse.json({ member: m.ok });
}
