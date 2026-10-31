"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import s from "./profilepanels.module.css";

// Kept here (not imported from lib/plans) so the price list stays out of the dashboard bundle.
const NETWORKS = ["Citipower", "Powercor", "United Energy", "Jemena", "AusNet Services"];

/** The network row on My home, with a quiet "Change" that saves straight away. */
export default function NetworkEdit({ value }: { value: string | null }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    if (!supabase || !pick || pick === value) { setOpen(false); return; }
    setSaving(true);
    setMsg("");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/member-settings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ distributor: pick }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!body?.ok) { setSaving(false); setMsg(body?.message ?? "Couldn't save that. Please try again."); return; }
    // Every price on the dashboard depends on the network: reload so they all follow.
    window.location.reload();
  }

  return (
    <div className={s.row}>
      <span className={s.label}>Network</span>
      {open ? (
        <span className={s.netEdit}>
          <label className={s.srOnly} htmlFor="netPick">Your electricity network</label>
          <select id="netPick" value={pick} onChange={(e) => setPick(e.target.value)}>
            {!value && <option value="">Choose your network</option>}
            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" className={s.netCancel} onClick={() => { setOpen(false); setPick(value ?? ""); }}>Cancel</button>
          <small>It&apos;s the &ldquo;Distributor&rdquo; on your bill. It decides the prices you can get.</small>
          {msg && <small className={s.netErr}>{msg}</small>}
        </span>
      ) : (
        <span className={s.value}>
          {value ?? <span className={s.missing}>Not set</span>}{" "}
          <button type="button" className={s.netChange} onClick={() => setOpen(true)}>Change</button>
        </span>
      )}
    </div>
  );
}
