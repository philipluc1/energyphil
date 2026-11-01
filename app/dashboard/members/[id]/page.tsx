import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripeClient";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { findPlan } from "@/lib/pricingPlans";
import { reasonLabel } from "@/lib/adminReports";
import AdminHeader from "../../AdminHeader";
import MemberActions, { type MemberEditable } from "./MemberActions";
import styles from "../../dashboard.module.css";

// Owner dashboard: one member (2 Nov 2026). Everything we hold, their
// payments from Stripe, and the edit / cancel / delete controls.
export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & { id: string; email: string; status: string; plan: string; amount_cents: number; created_at: string };

const day = (iso: unknown) => (typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" }) : "–");
const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–");
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashCookieValid((await cookies()).get(DASH_COOKIE)?.value))) redirect("/dashboard/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !supabaseAdmin) notFound();
  const db = supabaseAdmin;
  const { data } = await db.from("subscribers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Row;
  const email = m.email;

  const [history, bills, push, log] = await Promise.all([
    db.from("subscribers").select("id, created_at, plan, status, amount_cents").ilike("email", email.replace(/[%_\\]/g, "\\$&")).order("created_at", { ascending: false }),
    db.from("bills").select("fuel, period_end, billing_days, amount, retailer, source").ilike("email", email.replace(/[%_\\]/g, "\\$&")).order("period_end", { ascending: false }).limit(12),
    db.from("push_subscriptions").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")),
    db.from("admin_actions").select("created_at, action, detail").eq("member", email.toLowerCase()).order("created_at", { ascending: false }).limit(20),
  ]);

  // Their last few payments, straight from Stripe.
  let payments: { date: string; amount: number; status: string; url: string | null }[] = [];
  let paymentsNote: string | null = null;
  const customer = str(m.stripe_customer_id);
  if (stripe && customer) {
    try {
      const inv = await stripe.invoices.list({ customer, limit: 6 });
      payments = inv.data.map((i) => ({ date: new Date(i.created * 1000).toISOString(), amount: (i.amount_paid || i.amount_due) / 100, status: i.status ?? "", url: i.hosted_invoice_url ?? null }));
    } catch {
      paymentsNote = "Couldn't load payments from Stripe just now.";
    }
  } else paymentsNote = customer ? "Stripe isn't connected on this server." : "No Stripe customer (no payment yet).";

  const live = m.status === "active" || m.status === "past_due";
  const ending = live && str(m.cancel_at) && new Date(String(m.cancel_at)) > new Date();
  const state = m.status === "past_due" ? ["Payment failed", styles.pillBad] : !live ? ["Cancelled", styles.pillSoft] : ending ? [`Ends ${day(m.cancel_at)}`, styles.pillWarn] : ["Active", styles.pillGood];
  const editable: MemberEditable = {
    email,
    customer_name: str(m.customer_name),
    address: str(m.address),
    suburb: str(m.suburb),
    postcode: str(m.postcode),
    current_retailer: str(m.current_retailer),
    current_plan_name: str(m.current_plan_name),
    alert_min_saving: typeof m.alert_min_saving === "number" ? m.alert_min_saving : null,
    monthly_summary: m.monthly_summary !== false,
    unsubscribed: m.unsubscribed === true,
  };
  const ACTION: Record<string, string> = { edit: "Edited", cancel_now: "Cancelled now", cancel_at_period_end: "Set to cancel at period end", resume: "Cancellation undone", delete: "Deleted" };

  return (
    <div className={styles.wrap}>
      <AdminHeader />
      <Link href="/dashboard/members" className={styles.back}>← All members</Link>
      <div className={styles.memberHead}>
        <div>
          <h1>{str(m.customer_name) ?? email} <span className={state[1]}>{state[0]}</span></h1>
          <p>{email} · {findPlan(m.plan)?.name ?? m.plan} {money(m.amount_cents / 100)} · joined {day(m.created_at)}</p>
        </div>
        {customer && <a className={styles.btnGhost} href={`https://dashboard.stripe.com/customers/${customer}`} target="_blank" rel="noopener noreferrer">Open in Stripe ↗</a>}
      </div>

      <div className={styles.detailGrid}>
        <div>
          <MemberActions id={m.id} live={live} ending={!!ending} hasStripeSub={!!str(m.stripe_subscription_id)} periodEnd={str(m.current_period_end)} initial={editable} />
        </div>
        <div>
          <section className={styles.tableCard}>
            <h3 className={styles.cardH}>Membership</h3>
            <dl className={styles.facts}>
              <dt>Status</dt><dd>{state[0]}</dd>
              <dt>{live && !ending ? "Renews" : "Paid until"}</dt><dd>{day(m.current_period_end)}</dd>
              {str(m.cancel_reason) || str(m.cancel_comment) ? <><dt>Why they left</dt><dd>{reasonLabel(str(m.cancel_reason))}{str(m.cancel_comment) ? `: “${str(m.cancel_comment)}”` : ""}</dd></> : null}
              <dt>Came from</dt><dd>{str(m.source) ?? "–"}</dd>
              <dt>Referral code</dt><dd>{str(m.referral_code) ?? "–"}{str(m.referred_by) ? ` (referred by ${str(m.referred_by)})` : ""}</dd>
              <dt>Phone alerts</dt><dd>{(push.data ?? []).length ? `${(push.data ?? []).length} device${(push.data ?? []).length === 1 ? "" : "s"}` : "Off"}</dd>
            </dl>
          </section>
          <section className={styles.tableCard}>
            <h3 className={styles.cardH}>Their energy</h3>
            <dl className={styles.facts}>
              <dt>Network</dt><dd>{str(m.distributor) ?? "–"}</dd>
              <dt>Now with</dt><dd>{str(m.current_retailer) ?? "–"}{str(m.current_plan_name) ? `, ${str(m.current_plan_name)}` : ""}</dd>
              <dt>Last bill</dt><dd>{money(m.reference_total)}{typeof m.billing_days === "number" ? ` for ${m.billing_days} days` : ""}</dd>
              <dt>Cheapest found</dt><dd>{str(m.baseline_retailer) ?? "–"}{typeof m.baseline_total === "number" ? `, ${money(m.baseline_total)}` : ""}</dd>
              <dt>Switched</dt><dd>{str(m.switched_to) ? `${str(m.switched_to)}, ${day(m.switched_at)}` : "Not yet"}</dd>
              <dt>Gas</dt><dd>{str(m.gas_zone) ? `${str(m.gas_current_retailer) ?? "Gas bill"} on ${str(m.gas_zone)}` : "No gas bill"}</dd>
            </dl>
          </section>
          <section className={styles.tableCard}>
            <h3 className={styles.cardH}>Bills ({(bills.data ?? []).length})</h3>
            {(bills.data ?? []).length === 0 ? <p className={styles.emptyNote}>No bills saved.</p> : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th>Fuel</th><th>Period end</th><th>Days</th><th>Amount</th></tr></thead>
                  <tbody>
                    {((bills.data ?? []) as { fuel: string; period_end: string; billing_days: number; amount: number | null }[]).map((b, i) => (
                      <tr key={i}><td>{b.fuel === "gas" ? "Gas" : "Electricity"}</td><td>{day(b.period_end)}</td><td>{b.billing_days}</td><td>{money(b.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className={styles.tableCard}>
            <h3 className={styles.cardH}>Payments</h3>
            {paymentsNote ? <p className={styles.emptyNote}>{paymentsNote}</p> : payments.length === 0 ? <p className={styles.emptyNote}>No payments yet.</p> : (
              <ul className={styles.log}>
                {payments.map((p, i) => <li key={i}><b>{money(p.amount)}</b> · {day(p.date)} · {p.status}{p.url ? <> · <a href={p.url} target="_blank" rel="noopener noreferrer">receipt ↗</a></> : null}</li>)}
              </ul>
            )}
            <p className={styles.cardNote}>Refunds are done in Stripe (Open in Stripe, then the payment, then Refund).</p>
          </section>
          {(history.data ?? []).length > 1 && (
            <section className={styles.tableCard}>
              <h3 className={styles.cardH}>Earlier memberships</h3>
              <ul className={styles.log}>
                {((history.data ?? []) as Row[]).filter((h) => h.id !== m.id).map((h) => <li key={h.id}>{findPlan(h.plan)?.name ?? h.plan} {money(h.amount_cents / 100)} · joined {day(h.created_at)} · {h.status}</li>)}
              </ul>
            </section>
          )}
          <section className={styles.tableCard}>
            <h3 className={styles.cardH}>Changes made here</h3>
            {(log.data ?? []).length === 0 ? <p className={styles.emptyNote}>None yet.</p> : (
              <ul className={styles.log}>
                {((log.data ?? []) as { created_at: string; action: string; detail: { fields?: string[] } | null }[]).map((l, i) => (
                  <li key={i}><b>{ACTION[l.action] ?? l.action}</b>{l.detail?.fields ? ` (${l.detail.fields.join(", ")})` : ""} · {new Date(l.created_at).toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
