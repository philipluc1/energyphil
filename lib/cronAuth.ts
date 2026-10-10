import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Fails closed:
 *  without the secret set, anyone could trigger a run and its emails.
 *  Returns a response to send back when the request isn't allowed. */
export function rejectUnlessCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET isn't set in Vercel, so this job won't run." }, { status: 500 });
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  return null;
}
