"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isIos, isStandalone, keyBytes, swReady } from "@/lib/pwa";
import s from "./membersettings.module.css";
import a from "../account/account.module.css";

// "Phone notifications" on the Plus tab: turns on alerts on this phone
// (a cheaper plan, a discount ending, the monthly check). On an iPhone it
// only works once Utilo is on the home screen, so it says how.

type State = "loading" | "unsupported" | "ios-install" | "not-configured" | "denied" | "off" | "on";

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : null;
}

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) { if (live) setState(isIos() && !isStandalone() ? "ios-install" : "unsupported"); return; }
      const cfg = await fetch("/api/push").then((r) => r.json()).catch(() => null);
      if (!cfg?.configured || !cfg.publicKey) { if (live) setState("not-configured"); return; }
      if (live) setKey(cfg.publicKey);
      if (Notification.permission === "denied") { if (live) setState("denied"); return; }
      const reg = await swReady();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (live) setState(sub ? "on" : "off");
    })();
    return () => { live = false; };
  }, []);

  async function turnOn() {
    if (!key) return;
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); setMsg(perm === "denied" ? "" : "No problem. Turn it on any time."); return; }
      const reg = await swReady();
      if (!reg) { setMsg("Couldn't start notifications on this phone. Reload and try again."); return; }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      const headers = await authHeaders();
      const res = headers ? await fetch("/api/push", { method: "POST", headers, body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => null) : null;
      const body = await res?.json().catch(() => null);
      if (body?.ok) { setState("on"); setMsg("On for this phone. We'll only buzz you when it matters."); }
      else { await sub.unsubscribe().catch(() => {}); setMsg(body?.message || "Couldn't save that. Please try again."); }
    } catch {
      setMsg("Couldn't turn notifications on here. Check your phone allows them for Utilo.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await swReady();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const headers = await authHeaders();
        if (headers) await fetch("/api/push", { method: "DELETE", headers, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      setMsg("Off for this phone. Emails carry on as before.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg("");
    const headers = await authHeaders();
    const res = headers ? await fetch("/api/push", { method: "POST", headers, body: JSON.stringify({ test: true }) }).catch(() => null) : null;
    const body = await res?.json().catch(() => null);
    setBusy(false);
    setMsg(body?.message || "Couldn't send a test just now.");
  }

  if (state === "not-configured") return null;
  const on = state === "on";
  return (
    <div className={s.rowSetting}>
      <div>
        <b>Phone notifications</b>
        <p className={a.panelText}>
          {state === "ios-install"
            ? <>On iPhone, add Utilo to your home screen first: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open Utilo from there and turn this on.</>
            : state === "unsupported"
              ? "This browser can't show notifications. Try Chrome or Safari, or Utilo on your home screen."
              : state === "denied"
                ? "Notifications are blocked for Utilo. Allow them in your phone's settings, then come back here."
                : "A buzz on this phone when a cheaper plan turns up, your discount is ending, or your monthly check is ready."}
        </p>
        {on && <button type="button" className={s.testBtn} disabled={busy} onClick={test}>Send a test</button>}
        {msg && <p className={s.muted} role="status">{msg}</p>}
      </div>
      {(state === "on" || state === "off" || state === "loading") && (
        <button type="button" role="switch" aria-checked={on} aria-label="Phone notifications" className={`${s.switch} ${on ? s.switchOn : ""}`} disabled={busy || state === "loading"} onClick={on ? turnOff : turnOn}>
          <span className={s.knob} aria-hidden="true" />
          <span className={s.switchLabel}>{state === "loading" ? "…" : on ? "On" : "Off"}</span>
        </button>
      )}
    </div>
  );
}
