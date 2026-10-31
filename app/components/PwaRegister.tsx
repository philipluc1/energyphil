"use client";

import { useEffect } from "react";
import type { InstallPrompt } from "@/lib/pwa";

/** Registers the service worker (offline page and phone notifications), and
 *  keeps the browser's install prompt for the "Add to home screen" banner. */
export default function PwaRegister() {
  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      window.__utiloInstall = e as InstallPrompt;
      window.dispatchEvent(new Event("utilo-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", keep);
    const installed = () => { window.__utiloInstall = null; };
    window.addEventListener("appinstalled", installed);
    if (!("serviceWorker" in navigator)) return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", installed); };
    const go = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* not fatal */ });
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", installed); };
  }, []);
  return null;
}
