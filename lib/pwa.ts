"use client";

// Helpers for the home-screen app (31 Oct 2026).

/** Opened from the home screen icon (not a browser tab)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone or iPad (including iPads that say they're a Mac). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** The browser's "install this app" prompt, kept from when it fired (Android, desktop Chrome/Edge). */
export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
declare global {
  interface Window { __utiloInstall?: InstallPrompt | null }
}

/** The VAPID public key as the bytes pushManager.subscribe wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker, or null if it isn't ready within a few seconds. */
export async function swReady(ms = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
