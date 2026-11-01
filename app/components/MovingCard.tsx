"use client";

import { useState } from "react";
import Icon from "./Icon";
import RetailerLogo from "./RetailerLogo";
import { DISTRIBUTORS, rankPlans, topOpen, type Distributor } from "@/lib/plans";
import { vdoBillForUsage } from "@/lib/profileUsage";
import { guessDistributorFromPostcode } from "@/lib/postcodeNetwork";
import { supabase } from "@/lib/supabaseClient";
import type { ComparisonInput } from "./DashboardComparison";
import s from "./movingcard.module.css";

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

/**
 * "Moving house?" (1 Nov 2026), in My home. Type the new postcode and see
 * the cheapest plans there on today's prices, priced on the power they use
 * now. Members can then make it their address, so the daily check follows
 * them to the new place.
 */
export default function MovingCard({
  input,
  member,
  onMoved,
}: {
  input: ComparisonInput;
  member: boolean;
  onMoved?: (f: { postcode: string; suburb: string | null; address: string | null; distributor: Distributor; gas_zone?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [suburb, setSuburb] = useState("");
  const [address, setAddress] = useState("");
  const [picked, setPicked] = useState<Distributor | "">("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const pc = postcode.trim();
  const guess = /^\d{4}$/.test(pc) ? guessDistributorFromPostcode(pc) : null;
  const notVic = /^\d{4}$/.test(pc) && !pc.startsWith("3");
  const network: Distributor | null = picked || guess;

  // Two rankings of a few hundred plans: cheap enough to work out on each render.
  const result = (() => {
    if (!network || notVic) return null;
    const usage = { days: input.days, peak: input.peak, shoulder: input.shoulder, offpeak: input.offpeak, anytime: input.anytime, cl: input.cl, solarExportKwh: input.solarExportKwh, demandKw: input.demandKw ?? null };
    const perYear = input.days > 0 ? 365 / input.days : 0;
    const there = rankPlans(network, usage, { ev: input.ev, currentRetailer: input.currentRetailer });
    const open3 = there.filter((m) => !m.restricted).slice(0, 3);
    const best = topOpen(there);
    const here = topOpen(rankPlans(input.distributor, usage, { ev: input.ev, currentRetailer: input.currentRetailer }));
    const retailerThere = input.currentRetailer ? there.find((m) => !m.restricted && m.plan[0] === input.currentRetailer) ?? null : null;
    return {
      open3,
      perYear,
      bestYear: best ? best.total * perYear : null,
      hereYear: here ? here.total * perYear : null,
      vdoYear: vdoBillForUsage(network, usage) * perYear,
      retailerThere,
      count: there.length,
    };
  })();

  async function save() {
    if (!supabase || !network) return;
    setBusy(true);
    setMsg("");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/move-home", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ postcode: pc, suburb, address, distributor: network }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (body?.ok) {
      setSaved(true);
      onMoved?.({ postcode: body.postcode, suburb: body.suburb ?? null, address: body.address ?? null, distributor: body.distributor, ...(body.gas_zone ? { gas_zone: body.gas_zone } : {}) });
    } else setMsg(body?.message ?? "Couldn't save that. Try again.");
  }

  if (!open) {
    return (
      <section className={s.card}>
        <span className={s.icon} aria-hidden="true"><Icon name="home" size={20} /></span>
        <div className={s.closedText}>
          <b>Moving house?</b>
          <span>See the cheapest plans at your new address before you move{member ? ", then move your Utilo checks with you" : ""}.</span>
        </div>
        <button type="button" className={s.openBtn} onClick={() => setOpen(true)}>Check my new address</button>
      </section>
    );
  }

  return (
    <section className={`${s.card} ${s.cardOpen}`} aria-labelledby="moving-title">
      <div className={s.head}>
        <span className={s.icon} aria-hidden="true"><Icon name="home" size={20} /></span>
        <div>
          <h3 id="moving-title">Moving house?</h3>
          <p>A move is the easiest time to pick a cheaper plan: you&apos;re setting up power at the new place anyway.</p>
        </div>
        <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>

      <div className={s.fields}>
        <label>
          <span>New postcode</span>
          <input inputMode="numeric" maxLength={4} placeholder="3056" value={postcode} onChange={(e) => { setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4)); setPicked(""); setSaved(false); }} />
        </label>
        <label>
          <span>Suburb <em>(optional)</em></span>
          <input placeholder="Brunswick" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
        </label>
        <label className={s.wide}>
          <span>Street address <em>(optional)</em></span>
          <input placeholder="12 Smith Street" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
      </div>

      {notVic && <p className={s.note}>Utilo checks Victorian homes for now.</p>}
      {/^\d{4}$/.test(pc) && !notVic && (
        <div className={s.network}>
          <span>Power network{guess && !picked ? <> (from the postcode): <b>{guess}</b></> : ""}</span>
          <select value={network ?? ""} onChange={(e) => setPicked(e.target.value as Distributor)} aria-label="Power network at the new address">
            {!network && <option value="" disabled>Pick the network</option>}
            {DISTRIBUTORS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {result && network && (
        <div className={s.result}>
          <div className={s.tiles}>
            <div className={s.tile}>
              <span>Cheapest at the new place</span>
              <b>{result.bestYear !== null ? whole(result.bestYear) : "—"}</b>
              <small>a year, {network}</small>
            </div>
            <div className={s.tile}>
              <span>Cheapest where you are now</span>
              <b>{result.hereYear !== null ? whole(result.hereYear) : "—"}</b>
              <small>a year, {input.distributor}</small>
            </div>
            <div className={`${s.tile} ${s.tileGrey}`}>
              <span>Default offer there</span>
              <b>{whole(result.vdoYear)}</b>
              <small>a year, the reference price</small>
            </div>
          </div>
          <ol className={s.list}>
            {result.open3.map((m, i) => (
              <li key={`${m.plan[0]}|${m.plan[2]}`}>
                <span className={s.rank}>{i + 1}</span>
                <RetailerLogo name={m.plan[0]} size={30} />
                <span className={s.planText}><b>{m.plan[0]}</b><small>{m.plan[2]}</small></span>
                <b className={s.price}>{whole(m.total * result.perYear)}<small>/yr</small></b>
              </li>
            ))}
          </ol>
          {input.currentRetailer && (
            <p className={s.note}>
              {result.retailerThere
                ? <>Staying with <b>{input.currentRetailer}</b>? Their cheapest plan there is about {whole(result.retailerThere.total * result.perYear)} a year. Ask them to move you onto it rather than carrying your old plan across.</>
                : <><b>{input.currentRetailer}</b> has no plan we can price on the {network} network, so you&apos;d pick a new retailer for the new home.</>}
            </p>
          )}
          <p className={s.fine}>Priced on today&apos;s {result.count} plans for the power you use now. A different home can use more or less: snap the first bill from the new place and we&apos;ll re-check.</p>
          {member && (
            saved ? (
              <p className={s.ok}><Icon name="check" size={15} /> Done. Your daily checks now price plans for {pc}{suburb ? `, ${suburb}` : ""}.</p>
            ) : (
              <div className={s.actions}>
                <button type="button" className={s.saveBtn} disabled={busy} onClick={save}>{busy ? "Saving…" : "Make this my address"}</button>
                <span>Do this once you&apos;ve moved. Your old meter number is cleared; the first bill from the new place fills in the new one.</span>
              </div>
            )
          )}
          {msg && <p className={s.err}>{msg}</p>}
        </div>
      )}
    </section>
  );
}
