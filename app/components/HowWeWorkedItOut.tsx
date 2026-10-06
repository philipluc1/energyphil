import { VDO, type Distributor, type PlanRow } from "@/lib/plans";
import type { EstimatedUsage, HomeProfile } from "@/lib/profileUsage";
import styles from "./howworked.module.css";

const $ = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const c = (n: number) => `${(n * 100).toFixed(2)}c`;
const k = (n: number) => `${Math.round(n).toLocaleString("en-AU")} kWh`;

function profileWords(p: HomeProfile): string {
  const bits = [
    `${p.people}${p.people >= 6 ? "+" : ""} ${p.people === 1 ? "person" : "people"}`,
    p.dwelling,
    p.heating === "gas_none" ? "gas or no electric heating" : p.heating === "reverse_cycle" ? "reverse-cycle heating" : "electric heaters",
    p.cooling ? "air-con" : "no air-con",
    p.hotWater === "gas_solar" ? "gas/solar hot water" : p.hotWater === "heat_pump" ? "heat-pump hot water" : "electric hot water",
  ];
  if (p.pool) bits.push("pool");
  if (p.ev) bits.push(`EV charged ${p.evCharging === "overnight" ? "overnight" : "any time"}`);
  if (p.hasSolar) bits.push(`${p.solarKw} kW solar`);
  bits.push(p.daytimeHome === "home" ? "home most days" : p.daytimeHome === "away" ? "out most days" : "home some of the day");
  return bits.join(" · ");
}

interface Usage { days: number; peak: number; shoulder: number; offpeak: number; anytime: number; cl: number; solarExportKwh?: number }

export default function HowWeWorkedItOut({
  plan, usage, bench, haveBill, distributor, profile, est, priceDate,
}: {
  plan: PlanRow; usage: Usage; bench: number; haveBill: boolean; distributor: Distributor;
  profile: HomeProfile | null; est: EstimatedUsage | null; priceDate: string;
}) {
  const [, , , , supply, anytime, peak, shoulder, offpeak, clRate, fit] = plan;
  const totalKwh = usage.peak + usage.shoulder + usage.offpeak + usage.anytime;
  const solar = usage.solarExportKwh ?? 0;
  const lines: { label: string; sum: string; amt: number }[] = [];
  lines.push({ label: "Supply charge", sum: `${$(supply)} a day × ${usage.days} days`, amt: supply * usage.days });
  if (anytime !== null) {
    lines.push({ label: "Usage", sum: `${c(anytime)} × ${k(totalKwh)}`, amt: anytime * totalKwh });
  } else {
    if (peak !== null) lines.push({ label: "Peak usage", sum: `${c(peak)} × ${k(usage.peak)}`, amt: peak * usage.peak });
    if (usage.shoulder > 0) {
      const sr = shoulder ?? offpeak ?? peak;
      if (sr !== null)
        lines.push({
          label: shoulder !== null ? "Shoulder usage" : "Shoulder usage (at off-peak rate)",
          sum: `${c(sr)} × ${k(usage.shoulder)}`,
          amt: sr * usage.shoulder,
        });
    }
    if (offpeak !== null) lines.push({ label: "Off-peak usage", sum: `${c(offpeak)} × ${k(usage.offpeak)}`, amt: offpeak * usage.offpeak });
  }
  if (clRate !== null && usage.cl > 0) lines.push({ label: "Controlled load", sum: `${c(clRate)} × ${k(usage.cl)}`, amt: clRate * usage.cl });
  if (solar > 0) {
    if (fit !== null) lines.push({ label: "Solar credit", sum: `${c(fit)} × ${k(solar)} exported`, amt: -fit * solar });
    else lines.push({ label: "Solar credit", sum: "this plan doesn't publish a feed-in rate", amt: 0 });
  }
  const total = lines.reduce((s, l) => s + l.amt, 0);
  const v = VDO[distributor];
  const vdoLines = haveBill
    ? []
    : [
        { label: "Supply", sum: `${$(v.supply)} × ${usage.days} days`, amt: v.supply * usage.days },
        { label: "Usage", sum: `${c(v.usage)} × ${k(totalKwh)}`, amt: v.usage * totalKwh },
        ...(usage.cl > 0 ? [{ label: "Controlled load", sum: `${c(v.cl)} × ${k(usage.cl)}`, amt: v.cl * usage.cl }] : []),
      ];

  return (
    <details className={styles.box}>
      <summary>How we worked this out</summary>
      <div className={styles.inner}>
        <div className={styles.step}>
          <div className={styles.n}>1</div>
          <div>
            <b>Your usage</b>
            {profile && est ? (
              <p>
                From your answers ({profileWords(profile)}) we estimate about <b>{k(est.totalKwh)}</b> over {usage.days} days, roughly{" "}
                {k(est.annualKwh)} a year. It&apos;s a typical figure for a home like yours, not a meter reading.
              </p>
            ) : (
              <p>You told us <b>{k(totalKwh + usage.cl)}</b> over {usage.days} days{haveBill ? ", and what you paid" : ""}.</p>
            )}
          </div>
        </div>
        <div className={styles.step}>
          <div className={styles.n}>2</div>
          <div>
            <b>{plan[0]} &ldquo;{plan[2]}&rdquo; at its published rates</b>
            <table className={styles.t}>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.label}><td>{l.label}</td><td>{l.sum}</td><td>{l.amt < 0 ? `−${$(-l.amt)}` : $(l.amt)}</td></tr>
                ))}
                <tr className={styles.tot}><td>Total for {usage.days} days</td><td /><td>{$(total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.step}>
          <div className={styles.n}>3</div>
          <div>
            <b>{haveBill ? "Your current bill" : "The default offer, for the same usage"}</b>
            {haveBill ? (
              <p>You entered <b>{$(bench)}</b> for this period.</p>
            ) : (
              <table className={styles.t}>
                <tbody>
                  {vdoLines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{l.sum}</td><td>{$(l.amt)}</td></tr>)}
                  <tr className={styles.tot}><td>Default offer total</td><td /><td>{$(bench)}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className={styles.step}>
          <div className={styles.n}>4</div>
          <div>
            <b>Saving</b>
            <p>{$(bench)} − {$(total)} = <b>{bench - total >= 0 ? $(bench - total) : `−${$(total - bench)}`}</b> for {usage.days} days.</p>
          </div>
        </div>
        <p className={styles.note}>
          <b>Not included:</b> sign-up credits, pay-on-time or other conditional discounts, exit fees, concessions and rebates. Rates are the
          retailers&apos; published figures as at {priceDate}, GST included. Confirm the price with the retailer before you switch.
        </p>
      </div>
    </details>
  );
}
