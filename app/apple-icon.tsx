import { ImageResponse } from "next/og";

// The icon iPhones use when someone adds Utilo to their home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5a623" }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="#171305"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
      </div>
    ),
    size,
  );
}
