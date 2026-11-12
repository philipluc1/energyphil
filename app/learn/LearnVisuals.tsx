import { BROAD_COVERAGE } from "@/lib/dataPolicy";
import { plusValue } from "@/lib/pricingPlans";
import { typicalHouseholdExample } from "@/lib/savings";
import { PLANS } from "@/lib/plans";
import { GAS_PLANS } from "@/lib/gasPlans";
import v from "./visuals.module.css";
import Icon from "../components/Icon";

/** Three steps, each with a small picture instead of a paragraph. */
export function StepsVisual() {
  const ex = typicalHouseholdExample();
  const bench = Math.round(ex.annualBench);
  const best = Math.round(ex.annualBest);
  const bestPct = bench > 0 ? Math.max(20, Math.round((best / bench) * 100)) : 70;
  // Electricity and gas plans we price, rounded down to the hundred ("1,500+").
  const planCount = (Math.floor((PLANS.length + GAS_PLANS.length) / 100) * 100).toLocaleString("en-AU");

  return (
    <ol className={v.steps}>
      <li className={`${v.step} ${v.s1}`}>
        <div className={v.pic} aria-hidden="true">
          <div className={v.phone}>
            <div className={v.bill}>
              <span className={v.billHead} />
              <span className={v.billLine} />
              <span className={v.billLine} />
              <span className={v.billAmt}>${Math.round((bench * 91) / 365).toLocaleString("en-AU")}</span>
            </div>
            <span className={v.scan} />
          </div>
        </div>
        <span className={v.num}>1</span>
        <h3>Snap your bill</h3>
        <p>30 seconds. No bill? A few taps.</p>
      </li>

      <li className={`${v.step} ${v.s2}`}>
        <div className={v.pic} aria-hidden="true">
          <div className={v.bars}>
            <div className={v.barRow}>
              <span>Default offer</span>
              <span className={v.barTrack}><span className={v.barGrey} style={{ width: "100%" }} /></span>
              <b>${bench.toLocaleString("en-AU")}</b>
            </div>
            <div className={v.barRow}>
              <span>Cheapest</span>
              <span className={v.barTrack}><span className={v.barTeal} style={{ width: `${bestPct}%` }} /></span>
              <b>${best.toLocaleString("en-AU")}</b>
            </div>
            <span className={v.saveTag}>Save ${Math.max(0, bench - best).toLocaleString("en-AU")} a year</span>
          </div>
        </div>
        <span className={v.num}>2</span>
        <h3>We sort {planCount}+ plans</h3>
        <p>Confusing rates, ranked for your home.</p>
      </li>

      <li className={`${v.step} ${v.s3}`}>
        <div className={v.pic} aria-hidden="true">
          <div className={v.notify}>
            <span className={v.notifyIcon}><Icon name="bell" size={15} /></span>
            <span>
              <b>Utilo</b>
              Your discount ends in 30 days. A better plan is ready.
            </span>
          </div>
          <div className={v.notify2}>
            <span className={v.notifyIcon}>✓</span>
            <span><b>Checked today</b>Still on the best deal</span>
          </div>
        </div>
        <span className={v.num}>3</span>
        <h3>We keep watching</h3>
        <p>Prices change weekly. We tell you when it pays to move.</p>
      </li>
      <li className={v.footnote}>Typical home, 4,000 kWh a year, averaged across Victoria&apos;s networks.</li>
    </ol>
  );
}

type Mark = "yes" | "no" | "member" | string;

// Victorian Energy Compare facts: its published guide, October 2026.
const ROWS: { label: string; icon: string; esc: Mark; vec: Mark; us: Mark }[] = [
  { label: "Sets the default offer and the rules", icon: "scale", esc: "yes", vec: "no", us: "no" },
  { label: "Compares plans for you", icon: "search", esc: "no", vec: "yes", us: "yes" },
  { label: "Covers retailers across Victoria", icon: "map", esc: "no", vec: "yes", us: "TRACKED" },
  { label: "Uses your own usage, not a typical home", icon: "home", esc: "no", vec: "With meter data", us: "From your bill" },
  { label: "Starts from a photo of your bill", icon: "camera", esc: "no", vec: "no", us: "yes" },
  { label: "Re-checks prices for you every day", icon: "refresh", esc: "no", vec: "no", us: "member" },
  { label: "Warns before your discount ends", icon: "bell", esc: "no", vec: "no", us: "member" },
];

function Cell({ m }: { m: Mark }) {
  if (m === "yes") return <span className={v.yes} aria-label="Yes">✓</span>;
  if (m === "no") return <span className={v.no} aria-label="No">–</span>;
  if (m === "member") return <span className={v.member}><span className={v.yes} aria-hidden="true">✓</span><small>Members</small></span>;
  return <span className={v.text}>{m}</span>;
}

/** Who does what: three role tiles, then a tick chart. */
export function RolesVisual({ planCount, retailers }: { planCount: number; retailers: number }) {
  return (
    <>
      <div className={v.roles}>
        <div className={v.role}>
          <span className={v.roleIcon} aria-hidden="true"><Icon name="landmark" size={26} /></span>
          <b>ESC</b>
          <span className={v.roleJob}>Sets the rules</span>
          <span className={v.roleSub}>The regulator. Sets the default offer each July.</span>
        </div>
        <div className={v.role}>
          <span className={v.roleIcon} aria-hidden="true"><Icon name="search" size={26} /></span>
          <b>Victorian Energy Compare</b>
          <span className={v.roleJob}>Finds today&apos;s deal</span>
          <span className={v.roleSub}>The Government&apos;s free comparison site. Broadest coverage.</span>
        </div>
        <div className={`${v.role} ${v.roleUs}`}>
          <span className={v.roleIcon} aria-hidden="true"><Icon name="bell" size={26} /></span>
          <b>Utilo</b>
          <span className={v.roleJob}>Finds it, then keeps watching</span>
          <span className={v.roleSub}>Built from your bill, not a typical home.</span>
        </div>
      </div>

      <div className={v.grid} role="table" aria-label="What each one does">
        <div className={`${v.gRow} ${v.gHead}`} role="row">
          <span role="columnheader" />
          <span role="columnheader">ESC</span>
          <span role="columnheader">Vic Compare</span>
          <span role="columnheader" className={v.gUsHead}>Utilo</span>
        </div>
        {ROWS.map((r) => (
          <div className={v.gRow} role="row" key={r.label}>
            <span role="rowheader" className={v.gLabel}><span className={v.gIcon} aria-hidden="true"><Icon name={r.icon} size={17} /></span>{r.label}</span>
            <span role="cell"><Cell m={r.esc} /></span>
            <span role="cell"><Cell m={r.vec} /></span>
            <span role="cell" className={v.gUs}><Cell m={r.us === "TRACKED" ? (retailers >= BROAD_COVERAGE ? "yes" : `The ${retailers} we track`) : r.us} /></span>
          </div>
        ))}
      </div>
      <p className={v.gNote}>
        Utilo prices {planCount} plans from {retailers} retailers, not every plan in the market. Utilo Plus is {plusValue().annual} a year.
      </p>
    </>
  );
}

/**
 * Why Utilo (1 Nov 2026): what we do that a one-off comparison doesn't.
 * We prompt; we never switch anyone without them.
 */
export function WhyUs({ changes, worth }: { changes: number; worth: number }) {
  return (
    <ul className={v.why}>
      <li className={v.whyHero}>
        <span className={v.whyIcon} aria-hidden="true"><Icon name="refresh" size={22} /></span>
        <b className={v.whyBig}>365<small> days a year</small></b>
        <span className={v.whyTitle}>We re-check every plan, every morning</span>
        <span className={v.whySub}>Priced against your own bill, not a typical home. Weekends and holidays too.</span>
      </li>
      <li>
        <span className={v.whyIcon} aria-hidden="true"><Icon name="bell" size={22} /></span>
        <span className={v.whyTitle}>We tell you when to move</span>
        <span className={v.whySub}>An email the day switching would save you ${worth}+ a year, and a month&apos;s warning before a discount ends. You decide; we never switch you.</span>
      </li>
      <li>
        <span className={v.whyIcon} aria-hidden="true"><Icon name="camera" size={22} /></span>
        <span className={v.whyTitle}>Built from your bill</span>
        <span className={v.whySub}>Snap a photo. We read your usage and the rates you actually pay, so the answer is yours.</span>
      </li>
      <li>
        <span className={v.whyIcon} aria-hidden="true"><Icon name="chart" size={22} /></span>
        <span className={v.whyTitle}><span className={v.liveDot} aria-hidden="true" /> Live market data</span>
        <span className={v.whySub}>Retailers&apos; published offers, pulled every day{changes > 0 ? `: ${changes} new or changed in the last 30 days` : ""}.</span>
      </li>
    </ul>
  );
}
