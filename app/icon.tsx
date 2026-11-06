import { ImageResponse } from "next/og";

// The site icon (browser tabs, search results, home screens): the Option F
// house on a navy tile (4 Nov 2026). The favicon.ico stays for older browsers.
// 7 Nov 2026: 192 (a multiple of 48), the size Google needs to show a favicon in search results.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 42, background: "#1E2A4A" }}>
        <svg width="135" height="135" viewBox="0 0 100 100"><path d="M50,15 L18,42 L18,85 L82,85 L82,42 Z" fill="#ffffff" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" /><path d="M51.2,51.5 L43,63.5 L48.3,63.5 L45.9,75.5 L57,60.2 L50.6,60.2 Z" fill="#F5A623" /></svg>
      </div>
    ),
    size,
  );
}
