import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import NotifyMe from "../components/NotifyMe";
import Icon from "../components/Icon";
import styles from "../components/Comparator.module.css";
import home from "../home.module.css";
import b from "./business.module.css";
import SiteFooter from "../components/SiteFooter";

export const metadata = pageMeta({
  title: "Utilo for business",
  description: "Utilo is starting with Victorian homes. Business electricity and gas checks are on the way. Leave your email and we'll tell you when they open.",
  path: "/business",
});

// Business is coming (1 Nov 2026). Until then: what it will do, and a waitlist.
export default function BusinessPage() {
  return (
    <>
      <SiteHeader active="business" />
      <div className={styles.wrap}>
        <section className={home.pageHead}>
          <span className={b.soon}><Icon name="bolt" size={14} /> Coming soon</span>
          <h1>Utilo for business</h1>
          <p className={styles.lede}>
            We&apos;re starting with Victorian homes. Business electricity and gas is next: the same bill photo, every plan priced against what you
            actually use, and a watch on the market so you hear when a better deal turns up.
          </p>
        </section>

        <section className={b.card} aria-labelledby="biz-notify">
          <h2 id="biz-notify">Tell me when it opens</h2>
          <p>One email when business checks are ready. Nothing else.</p>
          <NotifyMe label="Business" />
        </section>

        <ul className={b.points}>
          <li><span className={b.icon}><Icon name="camera" size={18} /></span><span><b>Snap your bill</b> Shops, offices, cafés and small sites on business tariffs.</span></li>
          <li><span className={b.icon}><Icon name="search" size={18} /></span><span><b>Every business plan</b> Priced on your own usage and rates, not a typical site.</span></li>
          <li><span className={b.icon}><Icon name="bell" size={18} /></span><span><b>A warning before contracts end</b> Business rates often jump when a fixed term runs out.</span></li>
        </ul>

        <p className={b.home}>
          Checking your home instead? <Link href="/check">Run the free home check →</Link>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
