import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt: crawl the public site; keep out members' pages, sign-up steps,
// referral and partner redirects, and the API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/welcome", "/subscribe/", "/dashboard", "/api/", "/r/", "/p/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
