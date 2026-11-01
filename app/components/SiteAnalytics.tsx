"use client";

import { Analytics } from "@vercel/analytics/next";

// Visitor counts (2 Nov 2026): Vercel Web Analytics, which uses no cookies.
// We send the page path only: never the query string or the #part of the
// address (sign-in links carry tokens there), and never the owner dashboard.
export default function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(e) => {
        try {
          const u = new URL(e.url);
          if (u.pathname.startsWith("/dashboard")) return null;
          const keep = new URLSearchParams();
          // Campaign tags only, so the traffic report can show which ads work.
          for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
            const val = u.searchParams.get(k);
            if (val) keep.set(k, val.slice(0, 60));
          }
          const q = keep.toString();
          return { ...e, url: `${u.origin}${u.pathname}${q ? `?${q}` : ""}` };
        } catch {
          return null;
        }
      }}
    />
  );
}
