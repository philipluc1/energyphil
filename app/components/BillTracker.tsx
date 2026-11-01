"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import BillPhotoUpload from "./BillPhotoUpload";
import { supabase } from "@/lib/supabaseClient";
import { monthBill, trackMonths, trackerTotals, type Fuel, type TrackedBill, type TrackedMonth } from "@/lib/billTracker";
import { MONTH_NAMES } from "@/lib/profileUsage";
import { billChange, latestPair } from "@/lib/billChange";
import type { ExtractedBill } from "@/lib/billExtraction";
import s from "./billtracker.module.css";

// "Your bills": every bill the member has uploaded, spread over the months it
// covered, as one column a month. A month with no bill shows as a dashed gap
// with a + to upload it or type it in. Adding a bill here only adds it to the
// tracker; it never changes the usage we price their plans on.

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const short = (m: number) => MONTH_NAMES[m].slice(0, 3);
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const startOf = (b: TrackedBill) => new Date(Date.parse(`${b.period_end}T00:00:00Z`) - (b.billing_days - 1) * 86_400_000).toISOString().slice(0, 10);

async function token(): Promise<string> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? "";
}

/**
 * `initialFuel` follows the dashboard's Electricity / Gas switch; `gasAccount`
 * shows the Gas tab even before a gas bill has been added, so a member can
 * fill in their gas months the same way.
 */
export default function BillTracker({ initialFuel = "electricity", gasAccount = false }: { initialFuel?: Fuel; gasAccount?: boolean }) {
  const [bills, setBills] = useState<TrackedBill[] | null>(null);
  const [fuel, setFuel] = useState<Fuel>(initialFuel);
  const [view, setView] = useState<"amount" | "usage">("amount");
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState<TrackedMonth | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setBills([]); return; }
    const { data, error } = await supabase.from("bills").select("id, fuel, period_end, billing_days, kwh, mj, amount, retailer, source").order("period_end", { ascending: true });
    if (error) { setFailed(true); setBills([]); return; }
    setBills(((data ?? []) as TrackedBill[]).map((b) => ({ ...b, kwh: b.kwh === null ? null : Number(b.kwh), mj: b.mj === null ? null : Number(b.mj), amount: b.amount === null ? null : Number(b.amount) })));
  }, []);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  const hasGas = gasAccount || initialFuel === "gas" || !!bills?.some((b) => b.fuel === "gas");
  const months = useMemo(() => trackMonths(bills ?? [], fuel, { minMonths: 6, maxMonths: 12 }), [bills, fuel]);
  const totals = useMemo(() => trackerTotals(months), [months]);
  // "Why did my bill change?" (2 Nov 2026): the latest bill against the one before, in one line.
  const change = useMemo(() => {
    const pair = latestPair((bills ?? []).filter((b) => b.fuel === fuel), (b) => (fuel === "gas" ? b.mj : b.kwh));
    return pair ? billChange(pair[0], pair[1], fuel === "gas" ? "gas" : "power") : null;
  }, [bills, fuel]);
  const unit = fuel === "gas" ? "MJ" : "kWh";
  const val = (m: TrackedMonth) => (view === "amount" ? m.amount : m.usage);
  const max = Math.max(...months.map(val), 1);
  const pick = months.find((m) => m.key === picked) ?? null;
  const byId = new Map((bills ?? []).map((b) => [b.id, b]));

  if (bills === null) return null;

  return (
    <section className={s.card} aria-labelledby="bt-title">
      <div className={s.head}>
        <div>
          <h3 id="bt-title" className={`${s.title} ${fuel === "gas" ? s.titleGas : ""}`}><Icon name={fuel === "gas" ? "flame" : "receipt"} size={18} /> Your {fuel === "gas" ? "gas " : ""}bills</h3>
          <p className={s.sub}>
            {totals.months === 0
              ? fuel === "gas" ? "Every gas bill you upload lands here, month by month. Gas swings with the seasons, so a full year tells the real story." : "Every bill you upload lands here, month by month. Add older ones to see your year."
              : <>{whole(totals.amount)} over {totals.months} month{totals.months === 1 ? "" : "s"} · about <b>{whole(totals.avgAmount)}</b> a month{totals.missing > 0 ? <> · <span className={s.gapCount}>{totals.missing} month{totals.missing === 1 ? "" : "s"} missing</span></> : null}</>}
          </p>
          {change && (
            <p className={s.change}>
              <b>Latest bill: {change.headline}.</b>
              {change.reasons.length > 0 ? <> {change.reasons.slice(0, 2).join(", and ").replace(/^./, (c) => c.toUpperCase())}.</> : null}
            </p>
          )}
        </div>
        <div className={s.toggles}>
          {hasGas && (
            <div className={s.seg} role="tablist" aria-label="Fuel">
              {(["electricity", "gas"] as Fuel[]).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={fuel === f} className={fuel === f ? s.segOn : ""} onClick={() => { setFuel(f); setPicked(null); setAdding(null); }}>
                  <Icon name={f === "gas" ? "flame" : "bolt"} size={13} /> {f === "gas" ? "Gas" : "Power"}
                </button>
              ))}
            </div>
          )}
          <div className={s.seg} role="tablist" aria-label="Show">
            <button type="button" role="tab" aria-selected={view === "amount"} className={view === "amount" ? s.segOn : ""} onClick={() => setView("amount")}>$</button>
            <button type="button" role="tab" aria-selected={view === "usage"} className={view === "usage" ? s.segOn : ""} onClick={() => setView("usage")}>{unit}</button>
          </div>
        </div>
      </div>

      <div className={s.chart} role="img" aria-label={`Your ${fuel} bills by month`}>
        {months.map((m, i) => {
          const v = val(m);
          const h = m.covered > 0 ? Math.max(6, (v / max) * 100) : 0;
          const label = view === "amount" ? whole(m.amount) : `${m.usage.toLocaleString("en-AU")}`;
          if (m.status === "missing") {
            return (
              <div key={m.key} className={s.col}>
                <button type="button" className={`${s.bar} ${s.gap} ${adding?.key === m.key ? s.gapOn : ""}`} onClick={() => { setAdding(m); setPicked(null); }} aria-label={`Add your ${MONTH_NAMES[m.month]} ${m.year} bill`}>
                  <span className={s.plus}>+</span>
                </button>
                <small className={s.mLabel}>{short(m.month)}</small>
              </div>
            );
          }
          return (
            <div key={m.key} className={s.col}>
              <button
                type="button"
                className={`${s.bar} ${m.status === "now" && m.covered === 0 ? s.now : ""} ${picked === m.key ? s.barOn : ""}`}
                onClick={() => { if (m.covered > 0) { setPicked(picked === m.key ? null : m.key); setAdding(null); } }}
                aria-label={m.covered > 0 ? `${MONTH_NAMES[m.month]} ${m.year}: ${whole(m.amount)}, ${m.usage} ${unit}` : `${MONTH_NAMES[m.month]}: not billed yet`}
                disabled={m.covered === 0}
              >
                {m.covered > 0 && (
                  <>
                    <span className={`${s.val} ${h > 82 ? s.valIn : ""}`}>{label}</span>
                    <i className={`${s.fill} ${fuel === "gas" ? s.fillGas : ""} ${m.status === "part" || m.status === "now" ? s.fillPart : ""}`} style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }} />
                  </>
                )}
                {m.status === "now" && m.covered === 0 && <span className={s.nowTag}>Next bill</span>}
              </button>
              <small className={s.mLabel}>{short(m.month)}{m.month === 0 || i === 0 ? <em>{String(m.year).slice(2)}</em> : null}</small>
            </div>
          );
        })}
      </div>
      <div className={s.key}>
        <span><i className={`${s.fill} ${fuel === "gas" ? s.fillGas : ""}`} /> Covered by a bill</span>
        <span><i className={`${s.fill} ${fuel === "gas" ? s.fillGas : ""} ${s.fillPart}`} /> Part of the month</span>
        <span><i className={s.gapKey} /> Missing: tap to add</span>
      </div>

      {pick && (
        <div className={s.detail}>
          <b>{MONTH_NAMES[pick.month]} {pick.year}</b>
          <span>{whole(pick.amount)} · {pick.usage.toLocaleString("en-AU")} {unit}{pick.status === "part" ? ` · ${pick.covered} of ${pick.days} days covered` : ""}{pick.estimatedGap ? " · some figures weren't on the bill" : ""}</span>
          <ul>
            {pick.billIds.map((id) => byId.get(id)).filter((b): b is TrackedBill => !!b).map((b) => (
              <li key={b.id}>
                <span>
                  {b.retailer ?? "Bill"} · {fmtDay(startOf(b))} to {fmtDay(b.period_end)} ({b.billing_days} days)
                  {b.amount !== null ? <> · <b>{whole(b.amount)}</b></> : null}
                  {b.source === "typed" ? " · typed in" : ""}
                </span>
                <RemoveBill id={b.id} onDone={() => { setPicked(null); void load(); }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {adding && <AddBill month={adding} fuel={fuel} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); void load(); }} />}

      {!adding && (
        <button type="button" className={s.addOlder} onClick={() => { const first = months.find((m) => m.status === "missing") ?? months[0]; setAdding(first); setPicked(null); }}>
          + Add an older bill
        </button>
      )}
      {failed && <p className={s.fine}>The bill tracker switches on once the database is updated.</p>}
      <p className={s.fine}>Bills you add here are for your records. Your comparison still uses your latest bill.</p>
    </section>
  );
}

function RemoveBill({ id, onDone }: { id: string; onDone: () => void }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!sure) return <button type="button" className={s.linkBtn} onClick={() => setSure(true)}>Remove</button>;
  return (
    <span className={s.sure}>
      Remove this bill?{" "}
      <button type="button" className={s.linkBtn} disabled={busy} onClick={async () => {
        setBusy(true);
        await fetch("/api/bills", { method: "DELETE", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify({ id }) }).catch(() => null);
        onDone();
      }}>Yes</button>{" "}
      <button type="button" className={s.linkBtn} onClick={() => setSure(false)}>No</button>
    </span>
  );
}

function AddBill({ month, fuel, onClose, onSaved }: { month: TrackedMonth; fuel: Fuel; onClose: () => void; onSaved: () => void }) {
  const whole_ = monthBill(month.year, month.month);
  const [mode, setMode] = useState<"photo" | "type">("photo");
  const [end, setEnd] = useState(whole_.periodEnd);
  const [days, setDays] = useState(String(whole_.days));
  const [amount, setAmount] = useState("");
  const [use, setUse] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const unit = fuel === "gas" ? "MJ" : "kWh";

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/bills", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) }).catch(() => null);
    const r = await res?.json().catch(() => null);
    setBusy(false);
    if (r?.ok) onSaved();
    else setMsg(r?.message ?? "Couldn't save that bill. Try again.");
  }

  return (
    <div className={s.add}>
      <div className={s.addHead}>
        <b>Add your {MONTH_NAMES[month.month]} {month.year} {fuel === "gas" ? "gas " : ""}bill</b>
        <button type="button" className={s.close} onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className={s.seg} role="tablist" aria-label="How to add it">
        <button type="button" role="tab" aria-selected={mode === "photo"} className={mode === "photo" ? s.segOn : ""} onClick={() => setMode("photo")}><Icon name="camera" size={13} /> Upload it</button>
        <button type="button" role="tab" aria-selected={mode === "type"} className={mode === "type" ? s.segOn : ""} onClick={() => setMode("type")}><Icon name="file" size={13} /> Type it in</button>
      </div>
      {mode === "photo" ? (
        <div className={s.addBody}>
          <BillPhotoUpload
            variant="strip"
            fuel={fuel === "gas" ? "gas" : "electricity"}
            stripTitle="Snap or upload that bill"
            stripSub="We read the dates, usage and total, and add it to your tracker. Your comparison stays on your latest bill."
            onApply={(b: ExtractedBill) => void save({ ...b, periodEnd: b.periodEnd ?? whole_.periodEnd })}
          />
        </div>
      ) : (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); void save({ typed: true, fuel, periodEnd: end, billingDays: Number(days), amount: amount === "" ? null : Number(amount), [fuel === "gas" ? "mj" : "kwh"]: use === "" ? null : Number(use) }); }}>
          <label><span>Bill total</span><span className={s.inWrap}>$<input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 142.60" /></span></label>
          <label><span>Used <small>(optional)</small></span><span className={s.inWrap}><input type="number" inputMode="decimal" min={0} value={use} onChange={(e) => setUse(e.target.value)} placeholder={fuel === "gas" ? "e.g. 4,200" : "e.g. 320"} />{unit}</span></label>
          <label><span>Period ended</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label><span>Days on the bill</span><input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <button type="submit" className={s.save} disabled={busy || (amount === "" && use === "")}>{busy ? "Saving…" : "Add to my tracker"}</button>
        </form>
      )}
      {busy && mode === "photo" && <p className={s.fine}>Saving…</p>}
      {msg && <p className={s.err}>{msg}</p>}
    </div>
  );
}
