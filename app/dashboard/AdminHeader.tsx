"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import Wordmark from "../components/Wordmark";

/** The owner dashboard's top bar: brand, Overview / Members, log out. */
export default function AdminHeader() {
  const router = useRouter();
  const path = usePathname() ?? "";
  async function onLogout() {
    await fetch("/api/dashboard-logout", { method: "POST" });
    router.push("/dashboard/login");
  }
  const onMembers = path.startsWith("/dashboard/members");
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.adminLogo}><Wordmark /></span>
        <span className={styles.brandSub}>Dashboard</span>
      </div>
      <nav className={styles.adminNav} aria-label="Dashboard">
        <Link href="/dashboard" className={!onMembers ? styles.navOn : styles.navLink}>Overview</Link>
        <Link href="/dashboard/members" className={onMembers ? styles.navOn : styles.navLink}>Members</Link>
      </nav>
      <button type="button" className={styles.logoutBtn} onClick={onLogout}>
        Log out
      </button>
    </header>
  );
}
