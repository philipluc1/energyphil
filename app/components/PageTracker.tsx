"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sessionId } from "@/lib/track";
import { PING_EVERY_MS } from "@/lib/visits";

// Page views and "on the site now" for the owner dashboard (2 Nov 2026).
// Sends the page path only (never the ? or # part), and the site that sent
// them on the first page of a visit. Nothing on the owner dashboard is counted.
const LANDED = "utilo.landed";

function send(body: Record<string, unknown>) {
  try {
    const json = JSON.stringify({ ...body, sid: sessionId() });
    if (!navigator.sendBeacon?.("/api/pv", new Blob([json], { type: "application/json" }))) {
      void fetch("/api/pv", { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true }).catch(() => {});
    }
  } catch {
    /* counting must never break a page */
  }
}

export default function PageTracker() {
  const path = usePathname() ?? "/";
  useEffect(() => {
    if (path.startsWith("/dashboard")) return;
    let first = false;
    try {
      first = !window.sessionStorage.getItem(LANDED);
      window.sessionStorage.setItem(LANDED, "1");
    } catch { /* private mode: count it as a later page */ }
    send({ t: "view", path, first, ref: first ? document.referrer : null });
    const ping = () => { if (document.visibilityState === "visible") send({ t: "ping", path }); };
    const timer = window.setInterval(ping, PING_EVERY_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [path]);
  return null;
}
