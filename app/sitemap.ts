import type { MetadataRoute } from "next";
import { PLAN_DATA_DATE } from "@/lib/plans";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";
import { evNetworkRates } from "@/lib/evCalc";

// /sitemap.xml: the public pages only (never the dashboard, welcome or API).
// Pages built from the daily plan pull are dated by that pull.
export default function sitemap(): MetadataRoute.Sitemap {
  const pulled = new Date(`${PLAN_DATA_DATE}T00:00:00+10:00`);
  // The EV page only once there are overnight rates to show.
  const hasEv = evNetworkRates().length > 0;
  return PUBLIC_PAGES.filter((p) => p.path !== "/ev" || hasEv).map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: p.changeFrequency === "daily" || p.changeFrequency === "weekly" ? pulled : undefined,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
