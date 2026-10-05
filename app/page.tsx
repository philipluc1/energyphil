import type { CSSProperties } from "react";
import Link from "next/link";
import { PLANS, PLAN_DATA_DATE } from "@/lib/plans";
import { typicalHouseholdExample } from "@/lib/savings";
import SiteHeader from "./components/SiteHeader";
import ScrollReveal from "./components/ScrollReveal";
import Tag from "./components/Tag";
import CountUp from "./components/CountUp";
import ImageSlot from "./components/ImageSlot";
import styles from "./components/Comparator.module.css";
import home from "./home.module.css";

const PLAN_COUNT = PLANS.length;
const RETAILER_COUNT = new Set(PLANS.map((p) => p[0])).size;

function fmtUpdated(): string {
  return new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency0(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// Simple, consistent-stroke inline icons — no external icon library needed
// for a handful of marks, and it keeps the page a single self-contained file.
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function Home() {
  const example = typicalHouseholdExample();
  const barPct = example.annualBench > 0 ? Math.max(8, Math.round((example.annualBest / example.annualBench) * 100)) : 60;

  return (
    <>
      <SiteHeader active="home" />

      <section className={home.heroBand}>
        <div className={home.orbAmber} aria-hidden="true" />
        <div className={home.orbTeal} aria-hidden="true" />
        <div className={home.heroInner}>
          <div className={home.heroText}>
            <div className={`${home.chips} ${home.rise}`} style={{ "--d": "0ms" } as CSSProperties}>
              <Tag tone="amber" shine>Free check</Tag>
              <Tag tone="glass" dot>About 2 minutes</Tag>
              <Tag tone="glass">No sign-up</Tag>
            </div>
            <h1 className={`${home.heroTitle} ${home.rise}`} style={{ "--d": "120ms" } as CSSProperties}>
              Are you paying too much for electricity?
            </h1>
            <p className={`${home.heroLede} ${home.rise}`} style={{ "--d": "240ms" } as CSSProperties}>
              Tell us about your home. We&apos;ll find the cheapest Victorian plan for you and show what you&apos;d save.
            </p>
            <div className={`${home.heroActions} ${home.rise}`} style={{ "--d": "360ms" } as CSSProperties}>
              <Link href="/check" className={home.ctaBig}>
                Start my free check
                <span className={home.ctaArrow} aria-hidden="true">→</span>
              </Link>
              <Link href="/pricing" className={home.ctaGhost}>
                See pricing
              </Link>
            </div>
            <div className={`${home.heroStats} ${home.rise}`} style={{ "--d": "480ms" } as CSSProperties}>
              <div>
                <strong><CountUp value={PLAN_COUNT} /></strong>
                <span>live plans</span>
              </div>
              <div>
                <strong><CountUp value={RETAILER_COUNT} /></strong>
                <span>retailers</span>
              </div>
              <div>
                <strong>5</strong>
                <span>VIC networks</span>
              </div>
            </div>
          </div>

          <div className={`${home.heroMedia} ${home.rise}`} style={{ "--d": "300ms" } as CSSProperties}>
            <ImageSlot src="/images/hero.jpg" alt="A Victorian family home" ratio="4 / 5" icon={<IconHome />} priority className={home.heroPhoto} />
            <div className={home.floatCard}>
              <Tag tone="navy">Example, not a quote</Tag>
              <div className={home.floatLabel}>A typical home could save</div>
              <div className={home.floatBig}>
                <CountUp value={Math.round(example.annual)} prefix="$" />
                <span className={home.per}> a year</span>
              </div>
              <div className={home.barRow}>
                <span>Default offer</span>
                <div className={home.barTrack}><div className={home.barFull} /></div>
                <b>{fmtCurrency0(example.annualBench)}</b>
              </div>
              <div className={home.barRow}>
                <span>Cheapest plan</span>
                <div className={home.barTrack}><div className={home.barBest} style={{ "--w": `${barPct}%` } as CSSProperties} /></div>
                <b>{fmtCurrency0(example.annualBest)}</b>
              </div>
              <div className={home.floatNote}>Based on about {example.annualUsageKwh.toLocaleString("en-AU")} kWh a year. Yours will differ.</div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.wrap}>
        <section className={home.section}>
          <ScrollReveal>
            <h2 className={home.h2}>How it works</h2>
            <p className={home.sub}>Three steps. The first two are free.</p>
          </ScrollReveal>
          <div className={home.stepGrid}>
            {[
              { img: "step-home.jpg", alt: "Tapping answers about your home", icon: <IconHome />, tag: <Tag tone="green">Free</Tag>, h: "Tell us about your home", p: "Who lives there, how you heat it, whether you have solar or an EV. Just tap the answers." },
              { img: "step-save.jpg", alt: "Savings shown on a phone", icon: <IconChart />, tag: <Tag tone="green">Free</Tag>, h: "See what you could save", p: `We compare ${PLAN_COUNT} current plans from ${RETAILER_COUNT} retailers and show your saving per quarter, half-year and year.` },
              { img: "step-watch.jpg", alt: "A notification that a cheaper plan was found", icon: <IconBell />, tag: <Tag tone="amber" shine>Members</Tag>, h: "Switch, or let us keep watching", p: "Go straight to the retailer if you like what you see. Or join and we'll check every month for you." },
            ].map((st, i) => (
              <ScrollReveal key={st.h} delayMs={i * 120} className={home.stepCard}>
                <ImageSlot src={`/images/${st.img}`} alt={st.alt} ratio="16 / 10" icon={st.icon} className={home.stepImg} />
                <div className={home.stepBody}>
                  {st.tag}
                  <h3>{st.h}</h3>
                  <p>{st.p}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className={home.dataNote}>Plan prices last updated {fmtUpdated()}.</p>
        </section>

        <section className={home.section}>
          <ScrollReveal className={home.closing}>
            <div className={home.closingText}>
              <Tag tone="amber" shine>Free</Tag>
              <h2>Two minutes. No bill. No cost.</h2>
              <p>
                Find out what you could save, then decide. Questions? See the <Link href="/faq">FAQ</Link> or{" "}
                <Link href="/pricing">pricing</Link>.
              </p>
              <Link href="/check" className={home.ctaBig}>
                Start my free check
                <span className={home.ctaArrow} aria-hidden="true">→</span>
              </Link>
            </div>
            <ImageSlot src="/images/about.jpg" alt="Savings on a Victorian energy bill" ratio="16 / 11" icon={<IconBolt />} className={home.closingImg} />
          </ScrollReveal>
        </section>

        <footer className={styles.footer}>
          <div className={styles.fbrand}>Utilo</div>
          <p>
            Independent comparison for Victorian households — not affiliated with the Victorian Government or any
            retailer. Rates come from retailers&apos; published data; estimates only, so confirm with the retailer
            before switching.{" "}
            <Link href="/pricing">Pricing</Link> · <Link href="/faq">FAQ</Link> ·{" "}
            <Link href="/default-offer">About the VDO</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/cancellation-policy">Cancellation</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
