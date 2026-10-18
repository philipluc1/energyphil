"use client";

import { useState } from "react";
import type { ExtractedBill } from "@/lib/billExtraction";
import { DISTRIBUTORS, type Distributor } from "@/lib/plans";
import BillPagePrompt from "./BillPagePrompt";
import a from "../account/account.module.css";
import s from "./billreview.module.css";

// Members' dashboard: after a bill is read, show what we read as editable
// fields before anything is saved. Fix a wrong number, fill in what the photo
// missed, or add the next page of the bill and read them together.

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Math.round(n * 100) / 100));
const num = (v: string): number | null => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function BillReview({
  bill,
  pages,
  onReread,
  onSave,
  onCancel,
  saving,
}: {
  bill: ExtractedBill;
  pages: Blob[];
  /** A new read (with the next page added). */
  onReread: (bill: ExtractedBill, pages: Blob[]) => void;
  onSave: (bill: ExtractedBill) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [network, setNetwork] = useState<Distributor | "">(bill.distributor ?? "");
  const [days, setDays] = useState(str(bill.billingDays));
  const [detailed, setDetailed] = useState(bill.usageMode === "detailed");
  const [anytime, setAnytime] = useState(str(bill.anytimeKwh));
  const [peak, setPeak] = useState(str(bill.peakKwh));
  const [shoulder, setShoulder] = useState(str(bill.shoulderKwh));
  const [offpeak, setOffpeak] = useState(str(bill.offpeakKwh));
  const [cl, setCl] = useState(str(bill.controlledLoadKwh));
  const [solar, setSolar] = useState(str(bill.solarExportKwh));
  const [total, setTotal] = useState(str(bill.currentBill));

  const d = num(days);
  const daysOk = d !== null && d >= 1 && d <= 366;
  const usageKwh = detailed ? (num(peak) ?? 0) + (num(shoulder) ?? 0) + (num(offpeak) ?? 0) : num(anytime) ?? 0;
  const ready = !!network && daysOk && usageKwh > 0;

  function save() {
    if (!ready) return;
    onSave({
      ...bill,
      distributor: network as Distributor,
      billingDays: Math.round(d!),
      usageMode: detailed ? "detailed" : "simple",
      anytimeKwh: detailed ? null : num(anytime),
      peakKwh: detailed ? num(peak) : null,
      shoulderKwh: detailed ? num(shoulder) : null,
      offpeakKwh: detailed ? num(offpeak) : null,
      controlledLoadKwh: num(cl),
      solarExportKwh: bill.hasSolar ? num(solar) : null,
      currentBill: num(total),
    });
  }

  const field = (label: string, value: string, set: (v: string) => void, unit: string, missing = false) => (
    <label className={`${s.field} ${missing ? s.missing : ""}`}>
      <span>{label}</span>
      <span className={s.inputWrap}>
        <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={missing ? "Not found" : ""} />
        <small>{unit}</small>
      </span>
    </label>
  );

  return (
    <div className={s.review} role="group" aria-labelledby="review-title">
      <div id="review-title" className={a.panelTitle}>
        {bill.retailerName ? `Check what we read from your ${bill.retailerName} bill` : "Check what we read"}
      </div>
      <p className={a.panelText}>Change anything that looks wrong, or fill in what we couldn&apos;t find, then save.</p>

      <BillPagePrompt bill={bill} pages={pages} onApply={onReread} typeItIn={<>Or type the missing figures into the boxes below.</>} />

      <div className={s.grid}>
        <label className={`${s.field} ${!network ? s.missing : ""}`}>
          <span>Network</span>
          <select value={network} onChange={(e) => setNetwork(e.target.value as Distributor)}>
            <option value="">Choose…</option>
            {DISTRIBUTORS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {field("Billing period", days, setDays, "days", !daysOk)}
        {field("Bill total", total, setTotal, "$")}
      </div>

      <div className={s.modeRow} role="radiogroup" aria-label="How your usage is shown on the bill">
        <button type="button" role="radio" aria-checked={!detailed} className={`${s.mode} ${!detailed ? s.modeOn : ""}`} onClick={() => setDetailed(false)}>One usage figure</button>
        <button type="button" role="radio" aria-checked={detailed} className={`${s.mode} ${detailed ? s.modeOn : ""}`} onClick={() => setDetailed(true)}>Peak, shoulder, off-peak</button>
      </div>
      <div className={s.grid}>
        {detailed ? (
          <>
            {field("Peak", peak, setPeak, "kWh", usageKwh <= 0)}
            {field("Shoulder", shoulder, setShoulder, "kWh")}
            {field("Off-peak", offpeak, setOffpeak, "kWh", usageKwh <= 0)}
          </>
        ) : (
          field("Electricity used", anytime, setAnytime, "kWh", usageKwh <= 0)
        )}
        {field("Hot-water meter (controlled load)", cl, setCl, "kWh")}
        {bill.hasSolar && field("Solar sent to the grid", solar, setSolar, "kWh")}
      </div>

      <div className={s.actions}>
        <button type="button" className={a.btnPrimary} onClick={save} disabled={!ready || saving}>
          {saving ? "Saving…" : "Save to my dashboard"}
        </button>
        <button type="button" className={a.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
        {!ready && <span className={s.hint}>Add the network, billing period and usage to save.</span>}
      </div>
    </div>
  );
}
