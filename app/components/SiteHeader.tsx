import Link from "next/link";
import styles from "./Comparator.module.css";
import AccountNavLink from "./AccountNavLink";

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

// "other" is for pages not represented by a nav tab (the policy/info pages
// below) — none of the three tabs show as active there.
export default function SiteHeader({ active }: { active: "home" | "check" | "pricing" | "learn" | "faq" | "account" | "other" }) {
  return (
    <header className={styles.top}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brandLink}>
          <span className={styles.brandMark}>
            <BrandMark />
          </span>
          <span className={styles.brandText}>
            <span className={styles.mark}>
              Util<span className={styles.accent}>o</span>
            </span>
            <span className={styles.slogan}>Pay less. Power on.</span>
          </span>
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/" className={active === "home" ? styles.navLinkActive : styles.navLink}>
            Home
          </Link>
          <Link href="/pricing" className={active === "pricing" ? styles.navLinkActive : styles.navLink}>
            Pricing
          </Link>
          <Link href="/learn" className={active === "learn" ? styles.navLinkActive : styles.navLink}>
            Learn
          </Link>
          <AccountNavLink className={active === "account" ? styles.navLinkActive : styles.navLink} />
        </nav>
        <Link href="/check" className={`${styles.navCta} ${active === "check" ? styles.navCtaOn : ""}`}>
          Free check <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
