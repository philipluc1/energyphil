import type { CurrentRates } from "@/lib/billExtraction";
import type { PlanRow } from "@/lib/plans";
import s from "./ratescompare.module.css";

// Your rates (read off your bill) beside the cheapest plan's published rates.
// Everything in cents and GST inclusive, like a bill. Lower is better for
// charges; higher is better for the solar feed-in credit.

type Key = "supply" | "anytime" | "peak" | "shoulder" | "offpeak" | "cl" | "solarFit";
const ROWS: { key: Key; label: string; unit: string; idx: number }[] = [
  { key: "supply", label: "Supply charge", unit: "c a day", idx: 4 },
  { key: "anytime", label: "Usage, anytime", unit: "c per kWh", idx: 5 },
  { key: "peak", label: "Usage, peak", unit: "c per kWh", idx: 6 },
  { key: "shoulder", label: "Usage, shoulder", unit: "c per kWh", idx: 7 },
  { key: "offpeak", label: "Usage, off-peak", unit: "c per kWh", idx: 8 },
  { key: "cl", label: "Controlled load", unit: "c per kWh", idx: 9 },
];

const c = (dollars: number) => `${(dollars * 100).toFixed(2)}c`;

export default function RatesCompare({
  current,
  plan,
  planLabel,
  dark = false,
  compact = false,
}: {
  /** Rates read from the customer's bill, or null if we don't have them. */
  current: CurrentRates | null;
  /** The cheapest plan's published rates. */
  plan: PlanRow;
  /** Column heading for the plan, e.g. the retailer's name. */
  planLabel: string;
  dark?: boolean;
  /** Narrow layout for the dashboard side column. */
  compact?: boolean;
}) {
  const rows = ROWS.filter((r) => (current?.[r.key] ?? null) !== null || plan[r.idx] !== null);
  const planFit = plan[10];
  const curFit = current?.solarFit ?? null;
  const better = (mine: number | null, theirs: number | null, higherIsBetter = false) => {
    if (mine === null || theirs === null || Math.abs(mine - theirs) < 1e-6) return [false, false];
    const mineBetter = higherIsBetter ? mine > theirs : mine < theirs;
    return [mineBetter, !mineBetter];
  };
  const structure = (p: { anytime: number | null; peak: number | null }) => (p.anytime !== null ? "Single rate" : p.peak !== null ? "Time of use" : "—");

  return (
    <div className={`${s.wrap} ${dark ? s.dark : ""} ${compact ? s.compact : ""}`}>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col"><span className={s.srOnly}>Rate</span></th>
            <th scope="col">Your bill</th>
            <th scope="col">{planLabel}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Tariff</th>
            <td>{current ? structure(current) : "—"}</td>
            <td>{structure({ anytime: plan[5], peak: plan[6] })}</td>
          </tr>
          {rows.map((r) => {
            const mine = current?.[r.key] ?? null;
            const theirs = plan[r.idx] as number | null;
            const [a, b] = better(mine, theirs);
            return (
              <tr key={r.key}>
                <th scope="row">
                  {r.label}
                  <small>{r.unit}</small>
                </th>
                <td className={a ? s.win : undefined}>{mine !== null ? c(mine) : "—"}</td>
                <td className={b ? s.win : undefined}>{theirs !== null ? c(theirs) : "—"}</td>
              </tr>
            );
          })}
          <tr>
            <th scope="row">
              Solar feed-in (FIT)
              <small>c per kWh you export</small>
            </th>
            {(() => {
              const [a, b] = better(curFit, planFit, true);
              return (
                <>
                  <td className={a ? s.win : undefined}>{curFit === null ? "Not on bill" : curFit > 0 ? c(curFit) : "None"}</td>
                  <td className={b ? s.win : undefined}>{planFit === null ? "Not offered" : planFit > 0 ? c(planFit) : "None"}</td>
                </>
              );
            })()}
          </tr>
        </tbody>
      </table>
      <p className={s.note}>
        {current
          ? "Including GST. Green is the better rate on each line."
          : "Including GST. Upload a bill and we fill in your column from it."}{" "}
        A feed-in tariff only matters if you have solar. Plan rates are as published, before discounts; the plan&apos;s price already takes its discounts off (assuming you pay on time).
      </p>
    </div>
  );
}
