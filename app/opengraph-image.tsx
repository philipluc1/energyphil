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
          <svg width="92" height="92" viewBox="0 0 100 100"><path d="M50,15 L18,42 L18,85 L82,85 L82,42 Z" fill="#ffffff" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" /><path d="M51.2,51.5 L43,63.5 L48.3,63.5 L45.9,75.5 L57,60.2 L50.6,60.2 Z" fill="#F5A623" /></svg>
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
