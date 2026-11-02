// Which rate rows to show, "your bill" beside a plan (2 Nov 2026, Phil: "the
// rates look confusing"). One price all day is one "Usage" row, whatever the
// bill calls it. Peak, shoulder and off-peak rows appear only when one side
// really is time of use, and controlled load only when the home has it.
import { normaliseRates, type CurrentRates } from "./billExtraction";
import type { PlanRow } from "./plans";

export interface RateRow {
  key: "supply" | "anytime" | "peak" | "shoulder" | "offpeak" | "cl" | "solarFit";
  label: string;
  unit: string;
  you: number | null;
  plan: number | null;
  perDay?: boolean;
  /** The feed-in: more is better. */
  higherIsBetter?: boolean;
}

export function rateRows(current: CurrentRates | null, plan: PlanRow, o: { cl?: boolean; solar?: boolean } = {}): RateRow[] {
  const you = normaliseRates(current);
  const [, , , , pSupply, pAny, pPeak, pShoulder, pOff, pCl, pFit] = plan;
  const youSingle = !!you && you.anytime !== null;
  const youTou = !!you && you.anytime === null && (you.peak !== null || you.offpeak !== null);
  const planSingle = pAny !== null;
  const planTou = pAny === null && (pPeak !== null || pOff !== null);
  const rows: RateRow[] = [{ key: "supply", label: "Daily supply", unit: "c a day", you: you?.supply ?? null, plan: pSupply, perDay: true }];
  if (youSingle || planSingle) rows.push({ key: "anytime", label: "Usage, anytime", unit: "one price all day, c per kWh", you: youSingle ? you!.anytime : null, plan: planSingle ? pAny : null });
  if (youTou || planTou) {
    rows.push({ key: "peak", label: "Peak", unit: "c per kWh", you: youTou ? you!.peak : null, plan: planTou ? pPeak : null });
    // Two-rate plans charge shoulder hours at the off-peak rate.
    if ((youTou && you!.shoulder !== null) || (planTou && pShoulder !== null)) rows.push({ key: "shoulder", label: "Shoulder", unit: "c per kWh", you: youTou ? you!.shoulder : null, plan: planTou ? (pShoulder ?? pOff) : null });
    rows.push({ key: "offpeak", label: "Off-peak", unit: "c per kWh", you: youTou ? you!.offpeak : null, plan: planTou ? pOff : null });
  }
  if (o.cl ?? (you?.cl ?? null) !== null) rows.push({ key: "cl", label: "Controlled load", unit: "c per kWh", you: you?.cl ?? null, plan: pCl });
  if (o.solar ?? ((you?.solarFit ?? null) !== null)) rows.push({ key: "solarFit", label: "Solar feed-in", unit: "c per kWh you export", you: you?.solarFit ?? null, plan: pFit ?? null, higherIsBetter: true });
  return rows.filter((r) => r.you !== null || r.plan !== null || r.key === "solarFit");
}
