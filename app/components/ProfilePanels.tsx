"use client";

import Link from "next/link";
import styles from "./profilepanels.module.css";

export interface ProfileData {
  customer_name: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  distributor: string | null;
  nmi: string | null;
  current_retailer: string | null;
  current_plan_name: string | null;
  tariff_type: string | null;
  usage_mode: string | null;
  billing_days: number | null;
  peak_kwh: number | null;
  shoulder_kwh: number | null;
  offpeak_kwh: number | null;
  anytime_kwh: number | null;
  controlled_load_kwh: number | null;
  has_solar: boolean | null;
  solar_export_kwh: number | null;
  baseline_retailer: string | null;
  baseline_plan_name: string | null;
  home_profile?: Record<string, unknown> | null;
  /** Where the figures came from: a read bill, or the answers in the check. */
  source?: "bill" | "answers";
}

const HEATING: Record<string, string> = { gas_none: "Gas or none", reverse_cycle: "Reverse-cycle", resistive: "Electric heaters" };
const HOTWATER: Record<string, string> = { gas_solar: "Gas or solar", electric_controlled: "Electric (controlled load)", electric_general: "Electric", heat_pump: "Heat pump" };
const DAYTIME: Record<string, string> = { away: "Out most days", some: "Home some of the day", home: "Home most days" };

function homeWords(h: Record<string, unknown>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (typeof h.people === "number") out.push({ label: "People", value: `${h.people}${h.people >= 6 ? "+" : ""}` });
  if (typeof h.dwelling === "string") out.push({ label: "Home type", value: h.dwelling.charAt(0).toUpperCase() + h.dwelling.slice(1) });
  if (typeof h.heating === "string") out.push({ label: "Heating", value: HEATING[h.heating] ?? h.heating });
  if (typeof h.cooling === "boolean") out.push({ label: "Air-con", value: h.cooling ? "Yes" : "No" });
  if (typeof h.hotWater === "string") out.push({ label: "Hot water", value: HOTWATER[h.hotWater] ?? h.hotWater });
  if (h.pool === true) out.push({ label: "Pool", value: "Yes" });
  if (h.ev === true) out.push({ label: "EV", value: h.evCharging === "overnight" ? "Charged overnight" : "Charged any time" });
  if (typeof h.daytimeHome === "string") out.push({ label: "During the day", value: DAYTIME[h.daytimeHome] ?? h.daytimeHome });
  return out;
}

const TARIFF_LABEL: Record<string, string> = {
  single_rate: "Single rate",
  time_of_use: "Time of use",
  demand: "Demand",
  flexible: "Flexible",
};

const kwh = (n: number | null | undefined) => (n === null || n === undefined ? null : `${Math.round(n).toLocaleString("en-AU")} kWh`);

function Row({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {value ? <span className={styles.value}>{value}</span> : <span className={styles.missing}>{hint ?? "Add from your next bill"}</span>}
    </div>
  );
}

/** "Your details" and "Usage & forecast" panels on the dashboard. Missing
 *  values show a nudge to upload a bill, which is where they come from. */
export default function ProfilePanels({ d }: { d: ProfileData }) {
  const days = d.billing_days ?? 0;
  const bands = (d.peak_kwh ?? 0) + (d.shoulder_kwh ?? 0) + (d.offpeak_kwh ?? 0);
  const total = bands + (d.anytime_kwh ?? 0) + (d.controlled_load_kwh ?? 0);
  const annual = days > 0 && total > 0 ? Math.round((total / days) * 365) : null;
  const perDay = days > 0 && total > 0 ? (total / days).toFixed(1) : null;
  const addr = [d.address, d.suburb, d.postcode].filter(Boolean).join(", ");
  const tariff = d.tariff_type ? TARIFF_LABEL[d.tariff_type] ?? d.tariff_type : d.usage_mode === "detailed" ? "Time of use" : d.usage_mode === "simple" ? "Single rate" : null;

  return (
    <div className={styles.grid}>
      <section className={`${styles.panel} ${styles.navy}`}>
        <h3>Your plan &amp; home</h3>
        <Row label="Name" value={d.customer_name} />
        <Row label="Supply address" value={addr || null} />
        <Row label="Network" value={d.distributor} hint="Set on the check page" />
        <Row label="NMI" value={d.nmi} />
        <Row label="Current retailer" value={d.current_retailer} hint="Tell us on the check page" />
        <Row label="Current offer" value={d.current_plan_name} />
        <Row label="Tariff type" value={tariff} />
        <Row label="Solar" value={d.has_solar === null ? null : d.has_solar ? `Yes${d.solar_export_kwh ? `, ${kwh(d.solar_export_kwh)} exported per bill` : ""}` : "No"} />
        <Row label="Best match found" value={d.baseline_retailer ? `${d.baseline_retailer}${d.baseline_plan_name ? ` — ${d.baseline_plan_name}` : ""}` : null} hint="Run a check" />
        {d.home_profile && homeWords(d.home_profile).length > 0 && (
          <>
            <h4 className={styles.sub}>Your home</h4>
            {homeWords(d.home_profile).map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
          </>
        )}
        <p className={styles.note}>
          {d.source === "answers"
            ? <>From your answers in the check. {d.baseline_retailer ? <a href="#read-bill">Read a bill</a> : <Link href="/check">Read a bill on the check page</Link>} to add your NMI, current offer and real usage.</>
            : <>Most of this is read from your bill. <a href="#read-bill">Upload a newer one</a> to update it.</>}
        </p>
      </section>

      <section className={`${styles.panel} ${styles.teal}`}>
        <h3>Your consumption</h3>
        <div className={styles.stats}>
          <div className={styles.stat}><b>{kwh(total) ?? "—"}</b><span>{d.source === "answers" ? "estimated" : "last bill"}{days ? ` (${days} days)` : ""}</span></div>
          <div className={styles.stat}><b>{perDay ? `${perDay} kWh` : "—"}</b><span>per day</span></div>
          <div className={styles.stat}><b>{annual ? kwh(annual) : "—"}</b><span>expected per year</span></div>
        </div>
        {bands > 0 && (
          <div className={styles.bands}>
            {[["Peak", d.peak_kwh], ["Shoulder", d.shoulder_kwh], ["Off-peak", d.offpeak_kwh], ["Controlled load", d.controlled_load_kwh]]
              .filter(([, v]) => (v as number | null) && (v as number) > 0)
              .map(([k, v]) => {
                const pct = Math.round(((v as number) / total) * 100);
                return (
                  <div key={k as string} className={styles.band}>
                    <span>{k as string}</span>
                    <div className={styles.track}><div className={styles.fill} style={{ width: `${pct}%` }} /></div>
                    <b>{pct}%</b>
                  </div>
                );
              })}
          </div>
        )}
        <div className={styles.placeholder}>
          <b>12-month usage forecast</b>
          <span>Coming soon. Once we have two or more bills, we&apos;ll show your expected usage and cost month by month, with seasonal highs for heating and cooling.</span>
        </div>
        {total === 0 && (
          <p className={styles.note}>
            No usage on file yet. <a href="#read-bill">Upload a bill</a> or <Link href="/check">run the check</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
