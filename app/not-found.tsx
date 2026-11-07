import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import styles from "./components/StaticPage.module.css";

/** A wrong or old link (7 Nov 2026): the site's own page, with somewhere useful to go. */
export default function NotFound() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Page not found</span>
          <h1>That page isn&apos;t here.</h1>
          <p className={styles.lede}>
            The link may be old or mistyped. The free check is one tap away, and members can sign in from the menu.
          </p>
          <p>
            <Link href="/check">Run a free bill check →</Link>
            {" · "}
            <Link href="/account">Member login</Link>
            {" · "}
            <Link href="/">Home</Link>
          </p>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
