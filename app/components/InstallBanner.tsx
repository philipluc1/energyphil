"use client";

import { useEffect, useState } from "react";
import { isIos, isStandalone } from "@/lib/pwa";
import s from "./installbanner.module.css";

// "Put Utilo on your home screen": on the dashboard, until it's installed or
// dismissed. Android and desktop Chrome get an Install button (the browser's
// own prompt); iPhone gets the two taps, since Safari has no prompt.

const KEY = "utilo-install-dismissed";

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export default function InstallBanner() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");

  useEffect(() => {
    if (isStandalone()) return;
    try { if (localStorage.getItem(KEY)) return; } catch { /* storage blocked: show it */ }
    const pick = () => setMode(window.__utiloInstall ? "prompt" : isIos() ? "ios" : "hidden");
    pick();
    window.addEventListener("utilo-install-ready", pick);
    return () => window.removeEventListener("utilo-install-ready", pick);
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    setMode("hidden");
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  };
  const install = async () => {
    const p = window.__utiloInstall;
    if (!p) return;
    await p.prompt();
    const choice = await p.userChoice.catch(() => null);
    window.__utiloInstall = null;
    if (choice?.outcome === "accepted") setMode("hidden");
  };

  return (
    <section className={s.banner} aria-labelledby="install-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.icon} src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div className={s.text}>
        <h2 id="install-title" className={s.title}>Put Utilo on your home screen</h2>
        {mode === "prompt" ? (
          <p className={s.sub}>One tap to your dashboard, and price alerts on your phone. Free, nothing to download from a store.</p>
        ) : (
          <p className={s.sub}>
            In Safari, tap <span className={s.key}><ShareIcon /> Share</span> then <span className={s.key}>Add to Home Screen</span>. Then open Utilo from your home screen to turn on alerts.
          </p>
        )}
      </div>
      <div className={s.actions}>
        {mode === "prompt" && <button type="button" className={s.install} onClick={install}>Install</button>}
        <button type="button" className={s.close} onClick={dismiss} aria-label="Not now">✕</button>
      </div>
    </section>
  );
}
