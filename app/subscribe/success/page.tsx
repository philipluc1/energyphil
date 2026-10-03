import Link from "next/link";
import { stripe } from "@/lib/stripeClient";
import { findPlan } from "@/lib/pricingPlans";
import styles from "./success.module.css";

export const dynamic = "force-dynamic";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let planName: string | null = null;
  let email: string | null = null;
  let confirmed = false;

  if (stripe && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const plan = findPlan(session.metadata?.planId ?? "");
      planName = plan?.name ?? null;
      email = session.customer_email ?? session.customer_details?.email ?? null;
      confirmed = session.payment_status === "paid" || session.status === "complete";
    } catch (err) {
      console.error("Couldn't retrieve checkout session on success page", err);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {confirmed ? (
          <>
            <div className={styles.check}>✓</div>
            <h1>You&apos;re all set</h1>
            <p>
              {planName ? `Your ${planName.toLowerCase()} plan is active` : "Your plan is active"}
              {email ? ` — we'll keep you posted at ${email}.` : "."}
            </p>
          </>
        ) : (
          <>
            <h1>Thanks</h1>
            <p>We&apos;re confirming your payment — if anything looks off, drop us a line.</p>
          </>
        )}
        <Link href="/" className={styles.backLink}>
          ← Back to VIC Energy Check
        </Link>
      </div>
    </div>
  );
}
