import type { CurrentRates } from "@/lib/billExtraction";
import { PLANS } from "@/lib/plans";
import { AVERAGE_ANNUAL_KWH } from "@/lib/profileUsage";
import Icon from "./Icon";
import s from "./billexplainer.module.css";

const money = (n: number) => (Math.abs(n) < 1 ? `${Math.round(Math.abs(n) * 100)}c` : `$${Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const cents = (dollars: number) => `${(dollars * 100).toLocaleString("en-AU", { maximumFractionDigits: 2 })}c`;
const kwh = (n: number) => `${Math.round(n).toLocaleString("en-AU")} kWh`;

export interface BillFacts {
  retailer: string | null;
  planName: string | null;
  days: number;
  /** kWh from the grid by band, for the bill period. */
  anytime: number;
  peak: number;
  shoulder: number;
  offpeak: number;
  cl: number;
  solarExportKwh: number;
  rates: CurrentRates | null;
  /** The bill's total, if read or typed. */
  total: number | null;
  distributor: string;
}

/** The best feed-in any plan on the network pays ($ a kWh). */
function bestFit(distributor: string): number | null {
  let best: number | null = null;
  for (const p of PLANS) if (p[1] === distributor && p[10] !== null && p[10] > (best ?? 0)) best = p[10];
  return best;
}

/**
 * A bill, translated: what you used, what each kWh costs, what you pay just to
 * be connected, what your solar earned, and where the money went. Built from
 * the numbers read off the bill (or typed), so it changes as they're fixed.
 */
export default function BillExplainer({ f }: { f: BillFacts }) {
  const r = f.rates;
  const general = f.anytime + f.peak + f.shoulder + f.offpeak;
  const used = general + f.cl;
  if (!(used > 0) || !(f.days > 0)) return null;
  const perDay = used / f.days;
  const typicalPerDay = AVERAGE_ANNUAL_KWH / 365;
  const ratio = perDay / typicalPerDay;
  const tou = !!r && r.peak !== null && r.offpeak !== null && r.anytime === null;

  // Money, from the rates on the bill.
  let usageCost: number | null = null;
  if (r) {
    if (r.anytime !== null && !tou) usageCost = r.anytime * general;
    else if (tou) usageCost = (r.peak ?? 0) * f.peak + (r.shoulder ?? r.peak ?? 0) * f.shoulder + (r.offpeak ?? 0) * f.offpeak + (f.anytime > 0 ? (r.peak ?? 0) * f.anytime : 0);
    if (usageCost !== null && f.cl > 0) usageCost += (r.cl ?? 0) * f.cl;
  }
  const supplyCost = r && r.supply !== null ? r.supply * f.days : null;
  const solarCredit = r && r.solarFit !== null && f.solarExportKwh > 0 ? r.solarFit * f.solarExportKwh : f.solarExportKwh > 0 ? 0 : null;
  const parts = usageCost !== null && supplyCost !== null ? usageCost + supplyCost - (solarCredit ?? 0) : null;
  // Discounts, concessions, fees or rounding: whatever the rates don't explain.
  const other = f.total !== null && parts !== null && Math.abs(f.total - parts) >= Math.max(1, f.total * 0.03) ? f.total - parts : 0;
  const total = f.total ?? parts;
  const perMonth = total !== null ? (total / f.days) * (365 / 12) : null;
  const best = bestFit(f.distributor);
  const fitGap = best !== null && r?.solarFit != null && f.solarExportKwh > 0 ? (best - r.solarFit) * f.solarExportKwh : 0;

  const segs =
    usageCost !== null && supplyCost !== null
      ? [
          { key: "use", label: "Power you used", v: usageCost, cls: s.segUse },
          { key: "supply", label: "Being connected", v: supplyCost, cls: s.segSupply },
          ...(other > 0 ? [{ key: "other", label: "Fees and other charges", v: other, cls: s.segOther }] : []),
        ]
      : [];
  const segTotal = segs.reduce((a, x) => a + x.v, 0);

  return (
    <section className={s.box} aria-labelledby="bill-plain-title">
      <div className={s.head}>
        <h3 id="bill-plain-title" className={s.title}>Your bill in plain English</h3>
        <p className={s.sub}>
          {[f.retailer, f.planName].filter(Boolean).join(" · ")}
          {f.retailer || f.planName ? " · " : ""}
          {f.days} days
        </p>
      </div>

      <div className={s.tiles}>
        <div className={s.tile}>
          <span className={`${s.icon} ${s.iUse}`} aria-hidden="true"><Icon name="bolt" size={18} /></span>
          <span className={s.label}>You used</span>
          <b className={s.big}>{kwh(used)}</b>
          <p>
            About {perDay.toLocaleString("en-AU", { maximumFractionDigits: 1 })} kWh a day:{" "}
            {ratio < 0.9 ? `about ${Math.round(ratio * 100)}% of a typical Victorian home` : ratio > 1.1 ? `about ${Math.round((ratio - 1) * 100)}% more than a typical home` : "about the same as a typical home"} (
            {typicalPerDay.toLocaleString("en-AU", { maximumFractionDigits: 0 })} a day).
          </p>
        </div>

        {r && (r.anytime !== null || tou) && (
          <div className={s.tile}>
            <span className={`${s.icon} ${s.iRate}`} aria-hidden="true"><Icon name="dollar" size={18} /></span>
            <span className={s.label}>Each kWh costs</span>
            <b className={s.big}>{tou ? `${cents(r.peak as number)} / ${cents(r.offpeak as number)}` : cents(r.anytime as number)}</b>
            <p>{tou ? "Peak and off-peak: dearer in the late afternoon and evening, cheaper overnight." : "The same price whatever time of day you use it."}</p>
          </div>
        )}

        {supplyCost !== null && r?.supply != null && (
          <div className={s.tile}>
            <span className={`${s.icon} ${s.iSupply}`} aria-hidden="true"><Icon name="home" size={18} /></span>
            <span className={s.label}>Just for being connected</span>
            <b className={s.big}>{money(r.supply)} a day</b>
            <p>
              {money(supplyCost)} on this bill{total ? <>, {Math.round((supplyCost / total) * 100)}% of it</> : null}. You pay it even if you use nothing, so a lower one
              matters for small users.
            </p>
          </div>
        )}

        {f.solarExportKwh > 0 && (
          <div className={s.tile}>
            <span className={`${s.icon} ${s.iSolar}`} aria-hidden="true"><Icon name="sun" size={18} /></span>
            <span className={s.label}>Your solar sent out</span>
            <b className={s.big}>{kwh(f.solarExportKwh)}</b>
            <p>
              {r?.solarFit != null ? (
                <>
                  Paid {cents(r.solarFit)} a kWh: {money(solarCredit ?? 0)} back.
                  {best !== null && best > r.solarFit + 0.0005 && fitGap >= 1 ? (
                    <> The best plan on {f.distributor} pays up to {cents(best)}: up to <b>{money(fitGap)} more</b> on a bill like this.</>
                  ) : null}
                </>
              ) : (
                <>We couldn&apos;t see what you&apos;re paid for it. Add your feed-in rate and we&apos;ll count it.</>
              )}
            </p>
          </div>
        )}
      </div>

      {segs.length > 0 && segTotal > 0 && (
        <div className={s.split}>
          <span className={s.label}>Where the money went</span>
          <div className={s.bar} role="img" aria-label={segs.map((x) => `${x.label} ${money(x.v)}`).join(", ")}>
            {segs.map((x) => <span key={x.key} className={x.cls} style={{ flexGrow: x.v }} />)}
          </div>
          <ul className={s.key}>
            {segs.map((x) => (
              <li key={x.key}><i className={x.cls} /> {x.label} <b>{money(x.v)}</b></li>
            ))}
            {solarCredit !== null && solarCredit > 0.005 && <li><i className={s.segSolar} /> Solar credit <b>−{money(solarCredit)}</b></li>}
            {other < 0 && <li><i className={s.segCredit} /> Discounts and credits <b>−{money(-other)}</b></li>}
          </ul>
        </div>
      )}

      {total !== null && (
        <p className={s.total}>
          <span>This bill: <b>{money(total)}</b></span>
          {perMonth !== null && <span>About <b>{money(perMonth)} a month</b></span>}
        </p>
      )}
    </section>
  );
}
