// Anonymous counts of how far people get through the check, so the owner can
// see checks started, finished and turned into members, by where people came
// from. Sends no name, email or address: just the step, a random id for this
// browser tab (so a refresh doesn't count twice), the network and the source.

import { readSourceCookie } from "./attribution";

export type CheckEvent = "check_started" | "check_completed" | "unlock_clicked" | "checkout_started";
export const CHECK_EVENTS: CheckEvent[] = ["check_started", "check_completed", "unlock_clicked", "checkout_started"];

const SID_KEY = "utilo.sid";

function sessionId(): string {
  try {
    let sid = window.sessionStorage.getItem(SID_KEY);
    if (!sid || !/^[a-z0-9]{12,40}$/.test(sid)) {
      sid = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32);
      window.sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  }
}

export function track(event: CheckEvent, extra: { distributor?: string; usage?: string } = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event, sid: sessionId(), source: readSourceCookie(), distributor: extra.distributor ?? null, usage: extra.usage ?? null });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/event", blob)) {
      void fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* counting must never break the check */
  }
}
