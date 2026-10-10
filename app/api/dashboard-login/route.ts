import { NextRequest, NextResponse } from "next/server";
import { DASH_COOKIE, dashToken, sameString } from "@/lib/dashAuth";

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ ok: false, message: "Dashboard password isn't set up on the server yet." }, { status: 500 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (!sameString(password, expected)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false, message: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASH_COOKIE, await dashToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
