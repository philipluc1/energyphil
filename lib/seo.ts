import type { Metadata } from "next";
import { SITE_NAME } from "./site";

/**
 * A page's title, description, canonical address and share preview, in one
 * place. Each public page sets its own: Next.js doesn't merge these into the
 * site-wide ones, so a page that set nothing would otherwise share the home
 * page's preview (or, with a site-wide canonical, tell Google it's a copy of it).
 */
export function pageMeta(o: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const full = o.absoluteTitle ? o.title : `${o.title} | ${SITE_NAME}`;
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_AU", url: o.path, title: full, description: o.description },
    twitter: { card: "summary_large_image", title: full, description: o.description },
  };
}
