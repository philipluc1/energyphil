// The site's public address, for canonical links, the sitemap and share
// previews. Set SITE_URL in Vercel once the domain is live (e.g.
// https://www.utiloaustralia.com.au). Until then Vercel's own production
// address is used, so search engines are never pointed at a domain that
// doesn't answer yet.
const fromEnv = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
export const SITE_URL = (fromEnv || "https://www.utiloaustralia.com.au").replace(/\/+$/, "");

export const SITE_NAME = "Utilo";

/** The pages search engines should find, with how often they change. */
export const PUBLIC_PAGES: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/check", changeFrequency: "daily", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/learn", changeFrequency: "weekly", priority: 0.8 },
  { path: "/market", changeFrequency: "daily", priority: 0.6 },
  { path: "/default-offer", changeFrequency: "monthly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/gas", changeFrequency: "daily", priority: 0.7 },
  { path: "/ev", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cancellation-policy", changeFrequency: "yearly", priority: 0.2 },
];
