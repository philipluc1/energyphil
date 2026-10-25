"use client";

import Link from "next/link";
import type { CurrentRates } from "@/lib/billExtraction";
import type { PlanRow } from "@/lib/plans";
import RatesCompare from "./RatesCompare";
import RetailerLogo from "./RetailerLogo";
import Icon from "./Icon";
import s from "./planaside.module.css";

export interface PlanAsideData {
  retailer: string | null;
  planName: string | null;
  priceType: string | null;
  fixedUntil: string | null;
  discountEnds: string | null;
  distributor: string | null;
  nmi: string | null;
  address: string | null;
  tariff: string | null;
  kwhPerDay: number | null;
  hasSolar: boolean | null;
  rates: CurrentRates | null;
  source: "bill" | "answers" | null;
}

const fmtDay = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};
const cents = (dollars: number | null) => (dollars === null ? null : `${(dollars * 100).toFixed(2)}c`);
/** 6203 •••• 456: enough to recognise, not enough to copy. */
const maskNmi = (n: string) => {
  const c = n.replace(/\s+/g, "");
  return c.length >= 8 ? `${c.slice(0, 4)} •••• ${c.slice(-3)}` : c;
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={s.row}>
      <dt>{label}</dt>
      <dd className={value ? undefined : s.missing}>{value ?? "From your next bill"}</dd>
    </div>
  );
}

/** "Your plan now": the customer's own plan, rates and supply details, kept in
 *  view beside the dashboard on wide screens. */
export default function PlanAside({ d, uploadHref, best, onEdit }: { d: PlanAsideData; uploadHref: string; best?: { plan: PlanRow; label: string; hideName?: boolean } | null; onEdit?: () => void }) {
  const r = d.rates;
  const rateRows: [string, string | null][] = r
    ? [
        ["Supply", r.supply !== null ? `${cents(r.supply)} a day` : null],
        ["Anytime", r.anytime !== null ? `${cents(r.anytime)} per kWh` : null],
        ["Peak", r.peak !== null ? `${cents(r.peak)} per kWh` : null],
        ["Shoulder", r.shoulder !== null ? `${cents(r.shoulder)} per kWh` : null],
        ["Off-peak", r.offpeak !== null ? `${cents(r.offpeak)} per kWh` : null],
        ["Controlled load", r.cl !== null ? `${cents(r.cl)} per kWh` : null],
        ["Solar feed-in", r.solarFit !== null ? `${cents(r.solarFit)} per kWh` : null],
      ]
    : [];
  const shownRates = rateRows.filter(([, v]) => v !== null);
  const price =
    d.priceType === "fixed" ? `Fixed${d.fixedUntil ? ` until ${fmtDay(d.fixedUntil)}` : ""}` : d.priceType === "variable" ? "Variable (can change)" : null;

  return (
    <section className={s.card} aria-label="Your plan now">
      <div className={s.head}>
        <RetailerLogo name={d.retailer} size={48} />
        <div className={s.headText}>
          <span className={s.kicker}>Your plan now</span>
          <b>{d.retailer ?? "Your retailer"}</b>
          <span className={s.plan}>{d.planName ?? (d.source === "answers" ? "Upload a bill to see your plan" : "Plan name from your next bill")}</span>
        </div>
      </div>

      {price && (
        <div className={d.priceType === "fixed" ? s.fixed : s.variable}>
          <Icon name={d.priceType === "fixed" ? "lock" : "refresh"} size={14} /> {price}
        </div>
      )}
      {d.discountEnds && (
        <div className={s.warn}>
          <Icon name="calendar" size={14} /> Discount ends {fmtDay(d.discountEnds)}
        </div>
      )}

      <dl className={s.rows}>
        <Row label="Network" value={d.distributor} />
        <Row label="Meter (NMI)" value={d.nmi ? maskNmi(d.nmi) : null} />
        <Row label="Address" value={d.address} />
        <Row label="Tariff" value={d.tariff} />
        <Row label="Usage" value={d.kwhPerDay !== null ? `${d.kwhPerDay.toFixed(1)} kWh a day` : null} />
        <Row label="Solar" value={d.hasSolar === null ? null : d.hasSolar ? "Yes" : "No"} />
      </dl>

      {best ? (
        <div className={s.rates}>
          <span className={s.ratesTitle}>Your rates vs the cheapest plan</span>
          <span className={s.ratesSub}>{best.hideName ? "Members see which retailer and plan" : `${best.label}: ${best.plan[2]}`}</span>
          <RatesCompare current={r} plan={best.plan} planLabel={best.label} compact />
        </div>
      ) : (
      <div className={s.rates}>
        <span className={s.ratesTitle}>Your rates <small>(inc. GST)</small></span>
        {shownRates.length > 0 ? (
          <dl className={s.rows}>
            {shownRates.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </dl>
        ) : (
          <p className={s.empty}>We read these off your bill. Upload one and they show here.</p>
        )}
      </div>
      )}

      <div className={s.actions}>
        <a href={uploadHref} className={s.primary}>Upload a new bill</a>
        {onEdit ? (
          <button type="button" onClick={onEdit} className={s.ghost}>Edit details</button>
        ) : (
          <Link href="/check" className={s.ghost}>Edit details</Link>
        )}
      </div>
    </section>
  );
}
