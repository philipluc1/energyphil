import { ImageResponse } from "next/og";

// The site icon (browser tabs, search results, home screens): the bolt mark
// from the header. The favicon.ico stays for older browsers.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 112, background: "linear-gradient(135deg, #ffd36b, #f5a623)" }}>
        <svg width="320" height="320" viewBox="0 0 24 24" fill="#171305"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
      </div>
    ),
    size,
  );
}
