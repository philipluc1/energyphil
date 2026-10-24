"use client";

import { useState } from "react";
import { PLANS } from "@/lib/plans";
import { supabase } from "@/lib/supabaseClient";
import Icon from "./Icon";
import s from "./solarcard.module.css";

/** Solar on the dashboard: what you send to the grid and what you're paid for it. */
export default function SolarCard({
  distributor,
  billingDays,
  exportKwh,
  fitDollars,
  onSaved,
}: {
  distributor: string | null;
  billingDays: number | null;
  exportKwh: number | null;
  /** The feed-in tariff on their record, $ a kWh. */
  fitDollars: number | null;
  onSaved: (next: { has_solar: boolean; solar_export_kwh: number | null; current_rates: Record<string, number | null> | null }) => void;
}) {
  const [kwhRaw, setKwhRaw] = useState(exportKwh ? String(Math.round(exportKwh)) : "");
  const [fitRaw, setFitRaw] = useState(fitDollars !== null ? String(Math.round(fitDollars * 100 * 100) / 100) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  let best: { rate: number; retailer: string } | null = null;
  for (const p of PLANS) if (p[1] === distributor && p[10] !== null && p[10] > (best?.rate ?? 0)) best = { rate: p[10], retailer: p[0] };
  const kwh = parseFloat(kwhRaw);
  const fit = parseFloat(fitRaw);
  const gap = best && fit >= 0 && kwh > 0 ? (best.rate - fit / 100) * kwh : 0;

  async function save() {
    setBusy(true);
    setMsg("");
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const res = await fetch("/api/member-solar", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ exportKwh: kwhRaw.trim() === "" ? null : kwh, fitCents: fitRaw.trim() === "" ? null : fit }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (body?.ok) {
      setMsg("Saved. Your comparison now counts it.");
      onSaved({ has_solar: body.has_solar, solar_export_kwh: body.solar_export_kwh, current_rates: body.current_rates ?? null });
    } else setMsg(body?.message ?? "Couldn't save that. Try again.");
  }

  return (
    <section className={s.card} aria-labelledby="solar-card-title">
      <div className={s.head}>
        <span className={s.icon} aria-hidden="true"><Icon name="sun" size={20} /></span>
        <div>
          <h3 id="solar-card-title" className={s.title}>Your solar</h3>
          <p className={s.sub}>From your bill: what you send to the grid and what you&apos;re paid for it. Plans pay very different feed-in rates.</p>
        </div>
      </div>
      <div className={s.row}>
        <label>
          <span>Sent to the grid{billingDays ? ` per ${billingDays}-day bill` : " per bill"}</span>
          <span className={s.unit}><input type="number" inputMode="decimal" min={0} placeholder="e.g. 160" value={kwhRaw} onChange={(e) => setKwhRaw(e.target.value)} /> kWh</span>
        </label>
        <label>
          <span>Feed-in tariff you get</span>
          <span className={s.unit}><input type="number" inputMode="decimal" min={0} step={0.01} placeholder="e.g. 3.3" value={fitRaw} onChange={(e) => setFitRaw(e.target.value)} /> c/kWh</span>
        </label>
        <button type="button" className={s.save} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {best && fitRaw.trim() !== "" && fit >= 0 && (
        <p className={s.tip}>
          {best.rate * 100 > fit + 0.05 ? (
            <>
              The best feed-in on {distributor} pays up to {(best.rate * 100).toLocaleString("en-AU", { maximumFractionDigits: 2 })}c
              {gap >= 1 ? <>: up to <b>${gap.toFixed(2)} more a bill</b> for you</> : null}. Some plans pay their top rate only on the first few kWh a day; your comparison weighs it against each plan&apos;s other prices.
            </>
          ) : (
            <>You&apos;re already on one of the best feed-in rates on {distributor}.</>
          )}
        </p>
      )}
      {msg && <p className={s.msg} role="status">{msg}</p>}
    </section>
  );
}
