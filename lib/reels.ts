// The reels on the site (7 Nov 2026). Drop the MP4s into public/video/ with
// these names and the slots light up; until a file is there the player falls
// back to the animated logo (home and result page) or "Coming soon" (Watch).
// Keep each under ~2.5 MB: 1080x1920, H.264, 24-30 fps, ~1.2 Mbit/s, AAC 64k.

export interface Reel {
  id: string;
  /** Path under /public. */
  src: string;
  poster: string;
  title: string;
  blurb: string;
  length: string;
}

export const LOGO_CLIP: Reel = {
  id: "logo",
  src: "/video/utilo-logo.mp4",
  poster: "/video/utilo-logo.jpg",
  title: "Every plan. Checked every day.",
  blurb: "The Utilo logo, animated.",
  length: "0:04",
};

export const REELS: Reel[] = [
  { id: "snap", src: "/video/reel-snap-check-save.mp4", poster: "/video/reel-snap-check-save.jpg", title: "Snap, check, save", blurb: "A photo of your bill to your cheapest plan, in about a minute.", length: "0:16" },
  { id: "why", src: "/video/reel-bill-went-up.mp4", poster: "/video/reel-bill-went-up.jpg", title: "Bill went up? Here's why", blurb: "A discount ended, 1 July prices, or an older plan version. The loyalty tax.", length: "0:17" },
  { id: "daily", src: "/video/reel-check-every-morning.mp4", poster: "/video/reel-check-every-morning.jpg", title: "We check every morning", blurb: "Prices change every week. You decide; we never switch you.", length: "0:16" },
];
