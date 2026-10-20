"use client";

import s from "./planviewtoggle.module.css";

/** "Cheapest per retailer" (default) or "All plans": a two-button switch above a plan list. */
export default function PlanViewToggle({
  all,
  onChange,
  retailers,
  plans,
  dark = false,
}: {
  all: boolean;
  onChange: (all: boolean) => void;
  retailers: number;
  plans: number;
  dark?: boolean;
}) {
  if (plans <= retailers) return null;
  return (
    <div className={`${s.toggle} ${dark ? s.dark : ""}`} role="group" aria-label="Which plans to show">
      <button type="button" aria-pressed={!all} onClick={() => onChange(false)}>
        Cheapest per retailer <span>{retailers}</span>
      </button>
      <button type="button" aria-pressed={all} onClick={() => onChange(true)}>
        All plans <span>{plans}</span>
      </button>
    </div>
  );
}
