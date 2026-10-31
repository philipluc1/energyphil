import type { MetadataRoute } from "next";

// Lets people add Utilo to their phone's home screen as an app: its own icon,
// full screen with no browser bars, opening straight to their dashboard.
// Served at /manifest.webmanifest and linked from every page by Next.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/account",
    name: "Utilo",
    short_name: "Utilo",
    description: "Your electricity bill, checked against every plan every morning.",
    start_url: "/account?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["finance", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My dashboard", url: "/account?source=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Snap a bill", url: "/account?source=app#savings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
