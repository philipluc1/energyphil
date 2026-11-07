import Link from "next/link";
import Icon from "./Icon";
import Wordmark from "./Wordmark";
import { ABOUT } from "@/lib/about";
import { PLUS_NAME } from "@/lib/pricingPlans";
import { PLANS } from "@/lib/plans";
import s from "./sitefooter.module.css";

/** The site footer (1 Nov 2026): one on every public page. */
export default function SiteFooter() {
  // "© 2026 Utilo · ABN … · Point Cook": the business name only when it isn't just "Utilo" again.
  const who = [ABOUT.businessName && ABOUT.businessName !== "Utilo" ? ABOUT.businessName : "", ABOUT.abn ? `ABN ${ABOUT.abn}` : "", ABOUT.location].filter(Boolean).join(" · ");
  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.brand}>
          <Link href="/" className={s.logo} aria-label="Utilo home">
            <span className={s.wordmark}><Wordmark ink="#ffffff" /></span>
          </Link>
          <p>Power and gas plans from {new Set(PLANS.map((p) => p[0])).size} retailers, priced on your own bill. Not a cent from retailers.</p>
          <p className={s.proud}>Proudly Australian. Helping homes now, and businesses soon.</p>
          {ABOUT.contactEmail && <a className={s.mail} href={`mailto:${ABOUT.contactEmail}`}><Icon name="mail" size={14} /> {ABOUT.contactEmail}</a>}
        </div>
        <nav className={s.cols} aria-label="Footer">
          <div>
            <h3>Check</h3>
            <Link href="/check">Electricity</Link>
            <Link href="/gas">Gas</Link>
            <Link href="/ev">EV plans</Link>
            <Link href="/market">Market changes</Link>
            <Link href="/loyalty-tax">The loyalty tax</Link>
          </div>
          <div>
            <h3>{PLUS_NAME}</h3>
            <Link href="/pricing">Pricing</Link>
            <Link href="/learn">How it works</Link>
            <Link href="/faq">Questions</Link>
            <Link href="/account">Member login</Link>
          </div>
          <div>
            <h3>Utilo</h3>
            <Link href="/">Residential</Link>
            <Link href="/business">Business <em>Soon</em></Link>
            <Link href="/default-offer">The default offer</Link>
          </div>
          <div>
            <h3>Legal</h3>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cancellation-policy">Cancellation</Link>
          </div>
        </nav>
      </div>
      <div className={s.base}>
        <p>
          © {new Date().getFullYear()} Utilo{who ? ` · ${who}` : ""}. Independent: not affiliated with the Victorian Government or any retailer.
          Prices come from retailers&apos; published offers. Estimates only: confirm the price with the retailer before you switch.
        </p>
      </div>
    </footer>
  );
}
