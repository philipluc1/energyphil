import styles from "./dashboard.module.css";
import TestimonialsAdmin from "./TestimonialsAdmin";
import type { Testimonial } from "@/lib/testimonials";

const SOURCE_LABEL: Record<string, string> = {
  switched: "Email, 3 weeks after switching",
  member: "Email, 45 days after joining",
  reminder: "Reminder email",
  recap: "Renewal recap email",
  dashboard: "Dashboard card",
  link: "Review link you sent",
  home: "Home page",
};
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

/** Reviews (2 Nov 2026; Utilo's own review page from 14 Nov): who we've asked, who clicked through, and the reviews themselves. */
export default function ReviewsSection({ asked, clicked, clickedAfterAsk, bySource, ready, missing, testimonials = [], testimonialsMissing = false }: { asked: number; clicked: number; clickedAfterAsk: number; bySource: { source: string; n: number }[]; ready: boolean; missing: boolean; testimonials?: Testimonial[]; testimonialsMissing?: boolean }) {
  const top = bySource[0]?.n ?? 0;
  return (
    <div data-sec="reviews" id="reviews">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Reviews</span>
        <span className={styles.sectionNote}>Who we&apos;ve asked, who opened the review page, and the reviews waiting for you to approve.</span>
      </div>
      {(!ready || missing) && (
        <div className={styles.notice}>
          {missing ? <>Run the latest SQL in Supabase to turn review requests on. </> : null}
          {!ready ? <>Review requests are off.</> : null}
        </div>
      )}
      <div className={styles.statRow}>
        <div className={styles.statCard}><div className={styles.statValue}>{asked}</div><div className={styles.statLabel}>Members asked (by email)</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{clicked}</div><div className={styles.statLabel}>Members who clicked through (email or dashboard)</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{pct(clickedAfterAsk, asked)}</div><div className={styles.statLabel}>Of those emailed, clicked</div></div>
      </div>
      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Clicks by where they came from (this period)</div>
          {bySource.length === 0 ? (
            <p className={styles.emptyNote}>No clicks yet.</p>
          ) : (
            <ul className={styles.barList}>
              {bySource.map((r) => (
                <li key={r.source}>
                  <span>{SOURCE_LABEL[r.source] ?? r.source}</span>
                  <span className={styles.barTrack}><span style={{ width: `${(r.n / top) * 100}%` }} /></span>
                  <b>{r.n}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>When we ask</div>
          <ul className={styles.barList} style={{ display: "grid", gap: 6 }}>
            <li style={{ display: "block" }}>3 weeks after a member says they switched</li>
            <li style={{ display: "block" }}>45 days after joining, if they haven&apos;t switched</li>
            <li style={{ display: "block" }}>One reminder a week later, only if they didn&apos;t click. Never again after that</li>
            <li style={{ display: "block" }}>One line in the renewal recap, and a card on the dashboard after switching</li>
            <li style={{ display: "block" }}>Never to members who are cancelling, behind on payments or unsubscribed. Nothing offered for a review</li>
          </ul>
        </div>
      </div>
      <TestimonialsAdmin list={testimonials} missing={testimonialsMissing} />
    </div>
  );
}
