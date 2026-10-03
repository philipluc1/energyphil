import Link from "next/link";
import styles from "./Comparator.module.css";

export default function SiteHeader({ active }: { active: "home" | "check" | "account" }) {
  return (
    <header className={styles.top}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brandLink}>
          <span className={styles.mark}>
            VIC Energy<span className={styles.accent}>Check</span>
          </span>
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/" className={active === "home" ? styles.navLinkActive : styles.navLink}>
            Home
          </Link>
          <Link href="/check" className={active === "check" ? styles.navLinkActive : styles.navLink}>
            Check my bill
          </Link>
          <Link href="/account" className={active === "account" ? styles.navLinkActive : styles.navLink}>
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
