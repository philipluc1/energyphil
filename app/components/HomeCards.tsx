"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Icon from "./Icon";
import InfoTip from "./InfoTip";
import { compute, type ComparisonInput } from "./DashboardComparison";
import { likeYours } from "@/lib/homeInsights";
import type { HomeProfile } from "@/lib/profileUsage";
import s from "./insights.module.css";

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
function daysUntil(iso: string): number {
  const end = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  return Math.round((end - today) / 86400000);
}

/**
 * "Your discount ends in N days": the moment people start paying more. From
 * the dates a member sets on the Savings tab; without one, a prompt to add it.
 */
export function CountdownCard({ input, discountEndsAt, fixedUntil, onEdit }: {
  input: ComparisonInput | null;
  discountEndsAt: string | null;
  fixedUntil: string | null;
  onEdit: () => void;
}) {
  const saving = useMemo(() => {
    const c = input ? compute(input) : null;
    return c && c.haveBill ? c.savingYear : 0;
  }, [input]);
  // The ring fills in after mount, so it animates.
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 150); return () => clearTimeout(t); }, []);

  const pick = [
    discountEndsAt ? { iso: discountEndsAt, what: "Your discount ends" } : null,
    fixedUntil ? { iso: fixedUntil, what: "Your fixed price ends" } : null,
  ].filter((x): x is { iso: string; what: string } => !!x && daysUntil(x.iso) >= 0)
    .sort((a, b) => daysUntil(a.iso) - daysUntil(b.iso))[0];

  const style = { "--accent": "#f5a623", "--tagBg": "#fff3d6", "--tagFg": "#8a5300" } as CSSProperties;

  if (!pick) {
    return (
      <section className={s.side} style={style} aria-labelledby="cd-title">
        <span className={s.tag}><Icon name="bell" size={13} /> Price-rise watch</span>
        <h3 id="cd-title" className={s.sideTitle}>When does your discount end?</h3>
        <p className={s.sideLine}>Many plans are only cheap for the first year. Add the date from your bill or welcome pack and we&apos;ll count down, then email you a month before.</p>
        <button type="button" className={s.more} onClick={onEdit}>Add the date →</button>
      </section>
    );
  }

  const left = daysUntil(pick.iso);
  // A year's countdown fills the ring.
  const frac = Math.max(0, Math.min(1, left / 365));
  const R = 32;
  const C = 2 * Math.PI * R;
  const soon = left <= 30;
  return (
    <section className={s.side} style={{ ...style, ...(soon ? { "--accent": "#dc2626", "--tagBg": "#fee2e2", "--tagFg": "#b91c1c" } : {}) } as CSSProperties} aria-labelledby="cd-title">
      <span className={s.tag}><Icon name="bell" size={13} /> Price-rise watch</span>
      <div className={s.count}>
        <svg viewBox="0 0 76 76" className={s.ring} aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" stroke="#f1f3f8" strokeWidth="8" />
          <circle className={s.ringArc} cx="38" cy="38" r={R} fill="none" stroke={soon ? "#dc2626" : "#f5a623"} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={shown ? C * (1 - frac) : C} transform="rotate(-90 38 38)" />
          <text x="38" y="38" textAnchor="middle" className={s.ringNum} fill="#12141c">{left}</text>
          <text x="38" y="52" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5b6476">{left === 1 ? "day" : "days"}</text>
        </svg>
        <h3 id="cd-title" className={s.sideTitle}>
          {pick.what} on
          <br /><b style={{ fontSize: 22 }}>{fmtDate(pick.iso)}</b>
        </h3>
      </div>
      <p className={s.sideLine}>
        Prices usually go up then. {saving >= 1 ? <>The cheapest plan today would already save you <b className={s.good}>{whole(saving)} a year</b>.</> : "We'll re-check that week and email you a month before."}
      </p>
      <button type="button" className={s.more} onClick={onEdit}>Change the date</button>
    </section>
  );
}

const MIX: { key: "everyday" | "heating" | "cooling" | "hotWater" | "pool" | "ev"; label: string; color: string }[] = [
  { key: "everyday", label: "Everyday", color: "#22306e" },
  { key: "heating", label: "Heating", color: "#f87171" },
  { key: "cooling", label: "Cooling", color: "#5eead4" },
  { key: "hotWater", label: "Hot water", color: "#f5a623" },
  { key: "pool", label: "Pool", color: "#38bdf8" },
  { key: "ev", label: "Car", color: "#8b5cf6" },
];

/** Their kWh a day against what our model expects for a home with their setup. */
export function LikeYoursCard({ input, profile }: { input: ComparisonInput; profile: HomeProfile }) {
  const l = useMemo(() => {
    const c = compute(input);
    return c && !c.average ? likeYours(profile, c.usage) : null;
  }, [input, profile]);
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 200); return () => clearTimeout(t); }, []);
  if (!l) return null;
  // Scale: 0 to twice the typical figure.
  const at = (v: number) => `${Math.max(3, Math.min(97, (v / (l.typical * 2)) * 100))}%`;
  const pct = Math.round((l.ratio - 1) * 100);
  const line = Math.abs(pct) < 10
    ? "About what we'd expect for a home like yours."
    : pct < 0
      ? `${-pct}% less than we'd expect for a home like yours. Nicely done.`
      : `${pct}% more than we'd expect for a home like yours. Worth a look at what's running.`;
  const mixTotal = MIX.reduce((a, m) => a + Math.max(0, l.breakdown[m.key]), 0) || 1;
  const homeBits = [
    `${profile.people >= 6 ? "6+" : profile.people} ${profile.people === 1 ? "person" : "people"}`,
    profile.heating === "gas_none" ? "gas or no heating" : profile.heating === "reverse_cycle" ? "reverse-cycle heating" : "electric heaters",
    profile.pool ? "a pool" : null,
    profile.ev ? "an EV" : null,
    profile.hasSolar ? "solar" : null,
  ].filter(Boolean).join(", ");
  return (
    <section className={s.side} style={{ "--accent": "#8b5cf6", "--tagBg": "#f1ebfe", "--tagFg": "#6d28d9" } as CSSProperties} aria-labelledby="ly-title">
      <span className={s.tag}><Icon name="home" size={13} /> Homes like yours</span>
      <h3 id="ly-title" className={s.sideTitle}>
        You use <b>{l.you.toFixed(1)}</b> kWh a day
      </h3>
      <p className={s.sideLine} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span>{line}</span>
        <InfoTip label="How we worked this out">
          We compare the power on your bill with what our model expects for a home with your answers ({homeBits}). It&apos;s our estimate, not an official benchmark, and your home will differ for good reasons (insulation, the weather that quarter, who&apos;s home).
        </InfoTip>
      </p>
      <div className={s.gauge} aria-hidden="true">
        <span className={`${s.gaugeMark} ${s.markTyp}`} style={{ left: shown ? at(l.typical) : "50%" }}><span>Typical {l.typical.toFixed(1)}</span></span>
        <span className={`${s.gaugeMark} ${s.markYou}`} style={{ left: shown ? at(l.you) : "50%" }}><span>You</span></span>
      </div>
      <div className={s.mix} aria-label="Where a home like yours uses power">
        {MIX.filter((m) => l.breakdown[m.key] > 0).map((m) => <i key={m.key} style={{ width: `${(l.breakdown[m.key] / mixTotal) * 100}%`, background: m.color }} />)}
      </div>
      <div className={s.mixKey}>
        {MIX.filter((m) => l.breakdown[m.key] > 0).map((m) => <span key={m.key}><i style={{ background: m.color }} />{m.label} {Math.round((l.breakdown[m.key] / mixTotal) * 100)}%</span>)}
      </div>
    </section>
  );
}
