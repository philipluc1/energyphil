import Link from "next/link";
import styles from "./Comparator.module.css";

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

// "other" is for pages not represented by a nav tab (the policy/info pages
// below) — none of the three tabs show as active there.
export default function SiteHeader({ active }: { active: "home" | "check" | "pricing" | "faq" | "account" | "other" }) {
  return (
    <header className={styles.top}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brandLink}>
          <span className={styles.brandMark}>
            <BrandMark />
          </span>
          <span className={styles.mark}>
            Util<span className={styles.accent}>o</span>
          </span>
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/" className={active === "home" ? styles.navLinkActive : styles.navLink}>
            Home
          </Link>
          <Link href="/check" className={active === "check" ? styles.navLinkActive : styles.navLink}>
            Check my plan
          </Link>
          <Link href="/pricing" className={active === "pricing" ? styles.navLinkActive : styles.navLink}>
            Pricing
          </Link>
          <Link href="/faq" className={active === "faq" ? styles.navLinkActive : styles.navLink}>
            FAQ
          </Link>
          <Link href="/account" className={active === "account" ? styles.navLinkActive : styles.navLink}>
            My Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
