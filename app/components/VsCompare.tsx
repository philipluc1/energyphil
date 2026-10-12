import Link from "next/link";
import s from "./vscompare.module.css";

// Home-page "why Utilo" section. Deliberately doesn't name other comparison
// sites: the real competitor is checking once (or never). The named,
// balanced comparison lives on /learn#compare and in the FAQ.

// The year as two tracks: checked once vs watched.
const MOMENTS = [
  { when: "Today", icon: "✓", us: "Switch" },
  { when: "Discount", icon: "🔔", us: "Heads-up" },
  { when: "1 July", icon: "🔔", us: "Re-checked" },
  { when: "Daily", icon: "🔔", us: "Watched" },
];

export default function VsCompare() {
  return (
    <section className={s.wrap} aria-labelledby="vs-title">
      <h2 id="vs-title" className={s.title}>Checking once isn&apos;t enough</h2>
      <p className={s.lede}>Prices move all year. A discount ends, 1 July comes round, and a good deal quietly stops being one.</p>

      <div className={s.cards}>
        {/* 1. Speed */}
        <div className={s.card}>
          <span className={s.icon} aria-hidden="true">⚡</span>
          <h3 className={s.cardTitle}>A photo, not a form</h3>
          <div className={s.race} aria-label="Typing your details in takes about 10 minutes; a photo takes about 30 seconds">
            <div className={s.raceRow}>
              <span className={s.raceName}>Typing it in</span>
              <span className={s.raceTrack}><span className={s.raceVec} /></span>
              <span className={s.raceTime}>~10 min</span>
            </div>
            <div className={s.raceRow}>
              <span className={`${s.raceName} ${s.raceNameUs}`}>A photo</span>
              <span className={s.raceTrack}><span className={s.raceUs} /></span>
              <span className={`${s.raceTime} ${s.raceTimeUs}`}>~30 sec</span>
            </div>
          </div>
          <p className={s.cardText}>Snap your bill. We read the rest.</p>
        </div>

        {/* 2. Your real rates */}
        <div className={s.card}>
          <span className={s.icon} aria-hidden="true">🧾</span>
          <h3 className={s.cardTitle}>Your real rates, read for you</h3>
          <div className={s.billMini} aria-hidden="true">
            <span className={s.billRow}><span>Supply</span><b className={s.hl}>125.4c/day</b></span>
            <span className={s.billRow}><span>Usage</span><b className={s.hl}>32.9c/kWh</b></span>
            <span className={s.billRow}><span>Total</span><b>$425.31</b></span>
          </div>
          <p className={s.cardText}>We price your own plan, not a guess at it. Then one answer: switch or stay.</p>
        </div>

        {/* 3. Watching */}
        <div className={`${s.card} ${s.cardStar}`}>
          <span className={s.icon} aria-hidden="true">🔔</span>
          <h3 className={s.cardTitle}>We keep watching</h3>
          <div className={s.tracks}>
            <div className={s.track}>
              <span className={s.trackName}>Check once</span>
              <span className={s.trackLine}>
                <span className={s.dotOn} />
                <span className={s.dotOff} />
                <span className={s.dotOff} />
                <span className={s.dotOff} />
              </span>
            </div>
            <div className={s.track}>
              <span className={`${s.trackName} ${s.trackNameUs}`}>Utilo</span>
              <span className={`${s.trackLine} ${s.trackLineUs}`}>
                {MOMENTS.map((m) => (
                  <span key={m.when} className={s.dotUs} title={m.when}>{m.icon}</span>
                ))}
              </span>
            </div>
            <div className={s.trackLabels} aria-hidden="true">
              {MOMENTS.map((m) => <span key={m.when}>{m.when}</span>)}
            </div>
          </div>
          <p className={s.cardText}>A heads-up before your discount ends, after 1 July, and whenever a better plan appears. Silence when there&apos;s nothing to do.</p>
        </div>
      </div>

      <p className={s.honest}>
        Already use another comparison site? Good. <Link href="/learn#compare">See how we fit alongside it</Link>.
      </p>
    </section>
  );
}
