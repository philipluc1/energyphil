import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Link in every price-alert email. Deliberately a plain GET + simple HTML
// reply rather than a page component — there's nothing to review here, just
// a one-click "stop these emails" that works from any mail client.
function page(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>VIC Energy Check</title></head>
<body style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #222; padding: 0 20px;">
  <h2 style="margin-bottom: 4px;">VIC Energy<span style="color:#f0a202;">Check</span></h2>
  <p style="color:#444; line-height: 1.5;">${message}</p>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id");
  const table = type === "subscriber" ? "subscribers" : type === "lead" ? "leads" : null;

  if (!table || !id || !supabaseAdmin) {
    return new NextResponse(page("That unsubscribe link doesn't look right — please contact us directly instead."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const { error } = await supabaseAdmin.from(table).update({ unsubscribed: true }).eq("id", id);

  if (error) {
    console.error("unsubscribe failed", table, id, error);
    return new NextResponse(page("Something went wrong on our end — please just ignore any further emails, or contact us."), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const message =
    type === "subscriber"
      ? "You're unsubscribed from alert emails. This doesn't cancel your plan — contact us if you'd like to do that."
      : "You're unsubscribed — we won't email you about cheaper plans again.";

  return new NextResponse(page(message), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
