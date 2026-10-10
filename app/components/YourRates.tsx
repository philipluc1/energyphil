"use client";

import type { PriceTypeAnswer, RatesCostResult, RatesForm } from "@/lib/currentRates";
import styles from "./wizard.module.css";

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RateField({
  id, label, unit, value, onChange, placeholder, hint,
}: { id: string; label: string; unit: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string }) {
  return (
    <label className={styles.rate} htmlFor={id}>
      <span className={styles.rateLabel}>{label}</span>
      <span className={styles.suffixWrap}>
        <input id={id} type="number" inputMode="decimal" min={0} step="0.01" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        <span className={styles.suffix}>{unit}</span>
      </span>
      {hint && <span className={styles.rateHint}>{hint}</span>}
    </label>
  );
}

/** "Your rates": the prices on their current plan, copied from the bill.
 *  Optional, but it lets us price their own plan exactly and show it on the
 *  dashboard next to the cheapest. */
export default function YourRates({
  form,
  onChange,
  split,
  showCl,
  showSolar,
  cost,
  billTotal,
}: {
  form: RatesForm;
  onChange: (patch: Partial<RatesForm>) => void;
  /** Usage entered as peak / off-peak (so ask for time-of-use rates). */
  split: boolean;
  showCl: boolean;
  showSolar: boolean;
  cost: RatesCostResult;
  billTotal: number | null;
}) {
  const diff = cost.ok && billTotal !== null ? cost.total - billTotal : null;
  const close = diff !== null && billTotal !== null && Math.abs(diff) <= Math.max(10, billTotal * 0.08);

  return (
    <div className={styles.rates}>
      <p className={styles.where}>
        <span aria-hidden="true">🔎</span> On your bill, look for a table of charges like &ldquo;Supply charge 125.4c per day&rdquo; and &ldquo;Peak usage 32.1c per kWh&rdquo;. Copy the numbers in cents.
      </p>

      <div className={styles.rateGrid}>
        <RateField id="r-supply" label="Daily supply charge" unit="c/day" placeholder="e.g. 125.40" value={form.supply} onChange={(v) => onChange({ supply: v })} hint="A fixed charge for every day" />
        {split ? (
          <>
            <RateField id="r-peak" label="Peak" unit="c/kWh" placeholder="e.g. 38.50" value={form.peak} onChange={(v) => onChange({ peak: v })} />
            <RateField id="r-shoulder" label="Shoulder (if listed)" unit="c/kWh" placeholder="e.g. 27.00" value={form.shoulder} onChange={(v) => onChange({ shoulder: v })} />
            <RateField id="r-offpeak" label="Off-peak" unit="c/kWh" placeholder="e.g. 21.30" value={form.offpeak} onChange={(v) => onChange({ offpeak: v })} />
          </>
        ) : (
          <RateField id="r-anytime" label="Usage rate" unit="c/kWh" placeholder="e.g. 29.90" value={form.anytime} onChange={(v) => onChange({ anytime: v })} hint="If there are two steps, use the first" />
        )}
        {showCl && <RateField id="r-cl" label="Controlled load" unit="c/kWh" placeholder="e.g. 17.20" value={form.cl} onChange={(v) => onChange({ cl: v })} />}
        {showSolar && <RateField id="r-fit" label="Solar feed-in" unit="c/kWh" placeholder="e.g. 3.30" value={form.fit} onChange={(v) => onChange({ fit: v })} />}
      </div>

      <label className={styles.check}>
        <input type="checkbox" checked={form.exGst} onChange={(e) => onChange({ exGst: e.target.checked })} />
        <span>My bill shows these <b>excluding GST</b> (we&apos;ll add 10%)</span>
      </label>

      <div className={styles.subQ}>
        <span className={styles.subQLabel}>Are your prices fixed or variable?</span>
        <div className={styles.pills}>
          {([["variable", "Variable"], ["fixed", "Fixed"], ["unsure", "Not sure"]] as [PriceTypeAnswer, string][]).map(([v, l]) => (
            <button key={v} type="button" className={form.priceType === v ? styles.pillOn : styles.pill} onClick={() => onChange({ priceType: v })}>{l}</button>
          ))}
        </div>
        <span className={styles.rateHint}>
          {form.priceType === "fixed"
            ? "Fixed: locked for a set time. Rates can jump when it ends, so tell us when."
            : "Variable is most common: the retailer can change rates with notice, usually around 1 July. Your bill or welcome pack says which."}
        </span>
        {form.priceType === "fixed" && (
          <label className={styles.inline}>
            Fixed until <input type="date" value={form.fixedUntil} onChange={(e) => onChange({ fixedUntil: e.target.value })} />
          </label>
        )}
      </div>

      <div className={styles.subQ}>
        <span className={styles.subQLabel}>Does a discount or &ldquo;benefit period&rdquo; end soon? <span className={styles.opt}>(optional)</span></span>
        <span className={styles.rateHint}>
          Many plans are only cheap for the first year. If your bill or welcome pack gives an end date, add it and members get a reminder a month before.
        </span>
        <label className={styles.inline}>
          Ends on <input type="date" value={form.discountEnds} onChange={(e) => onChange({ discountEnds: e.target.value })} />
        </label>
      </div>

      <label className={styles.rate} htmlFor="r-plan">
        <span className={styles.rateLabel}>Plan name <span className={styles.opt}>(optional)</span></span>
        <input id="r-plan" type="text" placeholder="e.g. Value Saver" value={form.planName} onChange={(e) => onChange({ planName: e.target.value })} />
      </label>

      {cost.ok ? (
        <div className={`${styles.checkBox} ${billTotal === null || close ? styles.checkOk : styles.checkWarn}`}>
          {billTotal === null ? (
            <>✓ From your rates, this bill comes to about <b>{fmt(cost.total)}</b>. We&apos;ll use that as what you pay now.</>
          ) : close ? (
            <>✓ Your rates add up to <b>{fmt(cost.total)}</b>, close to your bill of {fmt(billTotal)}. Looks right.</>
          ) : (
            <>Your rates add up to <b>{fmt(cost.total)}</b> but your bill says {fmt(billTotal)}. Discounts, credits or a typo usually explain it. We&apos;ll use your bill total.</>
          )}
        </div>
      ) : cost.reason === "needCl" ? (
        <div className={`${styles.checkBox} ${styles.checkWarn}`}>You have a separate hot-water meter. Add its controlled-load rate so we can price your plan.</div>
      ) : cost.reason === "needSplit" ? (
        <div className={`${styles.checkBox} ${styles.checkWarn}`}>Your plan has peak and off-peak rates. Pick &ldquo;Split by time&rdquo; above and enter your peak and off-peak kWh so we can price it.</div>
      ) : null}
    </div>
  );
}
