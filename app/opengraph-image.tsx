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
          {/* 6 Nov 2026: the new logo (app/components/Wordmark.tsx), in white. */}
          <svg width="330" height="92" viewBox="130 330 1432 400">
            <g transform="translate(284 565) scale(3.67) translate(-50 -50)"><path d="M50,15 L18,42 L18,85 L82,85 L82,42 Z" fill="#ffffff" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" /><path d="M51.2,51.5 L43,63.5 L48.3,63.5 L45.9,75.5 L57,60.2 L50.6,60.2 Z" fill="#F5A623" /></g>
            <g fill="none" stroke="#ffffff" strokeWidth={88} strokeLinecap="round" strokeLinejoin="round"><path d="M520 466 L520 574 A90 90 0 0 0 700 574 L700 466" /><path d="M864 390 L864 610 Q864 664 929 664" /><path d="M810 500 L928 500" /><path d="M1062 520 L1062 664" /><path d="M1192 446 L1192 620 Q1192 664 1234 664" /></g>
            <circle cx="1062" cy="408" r="48" fill="#ffffff" />
            <circle cx="1418" cy="590" r="124" fill="#F5A623" />
            <path transform="translate(1418 590) scale(6.4) translate(-50 -63.5)" d="M51.2,51.5 L43,63.5 L48.3,63.5 L45.9,75.5 L57,60.2 L50.6,60.2 Z" fill="#ffffff" />
          </svg>
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
