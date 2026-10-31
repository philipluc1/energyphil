import { ImageResponse } from "next/og";
import { PLANS, RETAILER_COUNT } from "@/lib/plans";

// The picture shown when a Utilo link is shared (Facebook, LinkedIn,
// iMessage, WhatsApp, Slack) and used by X/Twitter too. Built at deploy time,
// so the plan count stays current. No made-up figures on it.
export const alt = "Utilo: compare Victorian electricity plans against your own bill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#22306e", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: "#f5a623", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="#171305"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
          </div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 900, letterSpacing: -1 }}>
            Util<span style={{ color: "#f5a623" }}>o</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1000 }}>
            Is there a cheaper power plan for your home?
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#d6dcf2", maxWidth: 1000 }}>
            Snap your Victorian electricity bill. We price {PLANS.length} plans from {RETAILER_COUNT} retailers for your usage, free.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#f5a623", fontWeight: 700 }}>Independent · Victorian homes · Electricity and gas</div>
      </div>
    ),
    size,
  );
}
