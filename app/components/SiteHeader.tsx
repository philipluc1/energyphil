import Link from "next/link";
import styles from "./Comparator.module.css";
import AccountNavLink from "./AccountNavLink";
import SiteMenu from "./SiteMenu";
import Wordmark from "./Wordmark";


// "other" is for pages not represented by a nav tab (the policy/info pages
// below) — none of the three tabs show as active there.
export default function SiteHeader({ active }: { active: "home" | "check" | "pricing" | "learn" | "faq" | "account" | "business" | "other" }) {
  const biz = active === "business";
  return (
    <header className={styles.top}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brandLink} aria-label="Utilo home">
          {/* 6 Nov 2026: the new logo, animated once per visit. */}
          <span className={styles.brandLogo}><Wordmark animate /></span>
        </Link>
        {/* Who it's for (1 Nov 2026): homes today, businesses coming. */}
        <nav className={styles.audience} aria-label="Who it's for">
          <Link href="/" className={biz ? styles.audBtn : styles.audOn} aria-current={biz ? undefined : "page"}>
            <span className={styles.audLong}>Residential</span><span className={styles.audShort}>Home</span>
          </Link>
          <Link href="/business" className={biz ? styles.audOn : styles.audBtn} aria-current={biz ? "page" : undefined}>
            Business <span className={styles.audSoon}>Soon</span>
          </Link>
        </nav>
        {/* No "Home" link: the logo goes home. */}
        <nav className={styles.navLinks} aria-label="Site">
          <Link href="/learn" className={active === "learn" ? styles.navLinkActive : styles.navLink}>
            How it works
          </Link>
          <Link href="/pricing" className={active === "pricing" ? styles.navLinkActive : styles.navLink}>
            <span className={styles.navPlus}>Utilo <span className={styles.navPlusTag}>Plus</span></span>
          </Link>
          <AccountNavLink className={active === "account" ? styles.navLinkActive : styles.navLink} />
        </nav>
        <Link href="/check" className={`${styles.navCta} ${active === "check" ? styles.navCtaOn : ""}`}>
          Free check <span aria-hidden="true">→</span>
        </Link>
        {/* Phones and small tablets: everything else behind the three-line menu (4 Nov 2026). */}
        <SiteMenu active={active} />
      </div>
    </header>
  );
}
