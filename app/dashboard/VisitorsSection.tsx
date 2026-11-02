import { pageLabel, type VisitReport } from "@/lib/visits";
import LiveNow from "./LiveNow";
import styles from "./dashboard.module.css";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
const n0 = (n: number) => n.toLocaleString("en-AU");

/** Visitors (2 Nov 2026): who's on now, where people land, what they look at, who sent them. */
export default function VisitorsSection({
  report,
  live,
  periodLabel,
  missing,
}: {
  report: VisitReport | null;
  live: { ok: boolean; count?: number; pages?: { path: string; n: number }[]; message?: string };
  periodLabel: string;
  /** The tables aren't in the database yet. */
  missing: boolean;
}) {
  return (
    <div data-sec="visitors">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Visitors</span>
        <span className={styles.sectionNote}>Who&apos;s on now, where they land and what they look at ({periodLabel})</span>
      </div>
      {missing && (
        <div className={styles.notice}>
          Visitor counts start once the latest SQL is run in Supabase (the <code>page_views</code> and <code>live_sessions</code> tables). Counting starts from then, not before.
        </div>
      )}
      <div className={styles.statRow}>
        <LiveNow initial={live} />
        <div className={styles.statCard}>
          <div className={styles.statValue}>{n0(report?.visitors ?? 0)}</div>
          <div className={styles.statLabel}>Visitors</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{n0(report?.views ?? 0)}</div>
          <div className={styles.statLabel}>Page views ({report?.pagesPerVisitor ?? 0} a visitor)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{pct(report?.startedCheck ?? 0, report?.visitors ?? 0)}</div>
          <div className={styles.statLabel}>Started a check ({n0(report?.startedCheck ?? 0)} visitors)</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Landing pages: the first page people saw</div>
          {!report?.landing.length ? (
            <p className={styles.emptyNote}>No visits counted yet.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Page</th><th>Visitors</th><th>Started a check</th></tr></thead>
                <tbody>
                  {report.landing.map((l) => (
                    <tr key={l.path}>
                      <td>{pageLabel(l.path)}{pageLabel(l.path) !== l.path ? <span className={styles.pillSoft}>{l.path}</span> : null}</td>
                      <td>{n0(l.visitors)}</td>
                      <td>{n0(l.checks)} <span className={styles.notYet}>({pct(l.checks, l.visitors)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Pages viewed</div>
          {!report?.pages.length ? (
            <p className={styles.emptyNote}>No visits counted yet.</p>
          ) : (
            <div className={`${styles.tableScroll} ${styles.tallScroll}`}>
              <table className={styles.table}>
                <thead><tr><th>Page</th><th>Views</th><th>Visitors</th></tr></thead>
                <tbody>
                  {report.pages.map((p) => (
                    <tr key={p.path}><td>{pageLabel(p.path)}</td><td>{n0(p.views)}</td><td>{n0(p.visitors)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Where they came from</div>
          {!report?.referrers.length ? (
            <p className={styles.emptyNote}>Nothing yet.</p>
          ) : (
            <ul className={styles.barList}>
              {report.referrers.map((r) => (
                <li key={r.host}>
                  <span>{r.host}</span>
                  <span className={styles.barTrack}><span style={{ width: `${(r.visitors / report.referrers[0].visitors) * 100}%` }} /></span>
                  <b>{n0(r.visitors)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.tableCard}>
          <div className={styles.chartTitle}>Device</div>
          {!report?.devices.length ? (
            <p className={styles.emptyNote}>Nothing yet.</p>
          ) : (
            <ul className={styles.barList}>
              {report.devices.map((d) => (
                <li key={d.device}>
                  <span style={{ textTransform: "capitalize" }}>{d.device}</span>
                  <span className={styles.barTrack}><span style={{ width: `${(d.visitors / report.visitors) * 100}%` }} /></span>
                  <b>{pct(d.visitors, report.visitors)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
