import type { Metadata, Viewport } from "next";
import "./globals.css";
import LeaveSiteGuard from "./components/LeaveSiteGuard";
import { SourceCapture } from "./components/SourceBanner";
import ScrollMotion from "./components/ScrollMotion";
import PwaRegister from "./components/PwaRegister";
import SiteAnalytics from "./components/SiteAnalytics";
import PageTracker from "./components/PageTracker";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "Snap your Victorian power bill and see which plans cost less for your home, priced on your own usage and rates. Free check, no account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Utilo: compare Victorian electricity plans against your own bill",
    // Each page sets its own title; this adds the brand after it.
    template: "%s | Utilo",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // No site-wide canonical or share title: each public page sets its own
  // (lib/seo.ts), so none of them claims to be a copy of the home page.
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_AU" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
  // Added to an iPhone home screen: opens full screen, named "Utilo".
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  // Google Search Console's "HTML tag" check (3 Nov 2026): set the code in Vercel, not here.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
    ? {
        verification: {
          ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : {}),
          ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } } : {}),
        },
      }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" data-theme="light" suppressHydrationWarning>
      <head>
        {/* 6 Nov 2026: the header logo animates on the first page of a visit only. Later pages (and
            client-side moves) get data-logo-seen, which turns the animation off. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var d=document.documentElement;if(sessionStorage.getItem('utilo.logo')){d.setAttribute('data-logo-seen','')}else{sessionStorage.setItem('utilo.logo','1');setTimeout(function(){d.setAttribute('data-logo-seen','')},1800)}}catch(e){}",
          }}
        />
        {/* Fonts: linked here rather than @import-ed from the CSS, so the
            browser fetches them straight away instead of after the stylesheet. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&family=Plus+Jakarta+Sans:wght@700&family=Karla:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
        />
      </head>
      <body>
        {children}
        <LeaveSiteGuard />
        <SourceCapture />
        <ScrollMotion />
        <PwaRegister />
        <SiteAnalytics />
        <PageTracker />
      </body>
    </html>
  );
}
