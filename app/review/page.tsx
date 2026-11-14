import { pageMeta } from "@/lib/seo";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import ReviewForm from "./ReviewForm";
import styles from "../components/StaticPage.module.css";

// Utilo's own review page (14 Nov 2026, Phil: in-house reviews instead of
// Google). The link to send: utilo.com.au/review. Reviews show on the home
// page once approved on the owner dashboard.

export const metadata = pageMeta({
  title: "Review Utilo",
  description: "Used Utilo for a free check or as a member? Tell other Victorians how it went: good, bad or in between.",
  path: "/review",
});

export default function ReviewPage() {
  return (
    <>
      <SiteHeader active="other" />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Reviews</span>
          <h1>How did Utilo go for you?</h1>
          <p className={styles.lede}>Good, bad or in between, an honest review helps other Victorians decide, and tells us what to fix. About a minute.</p>
        </section>
        <ReviewForm />
      </div>
      <SiteFooter />
    </>
  );
}
