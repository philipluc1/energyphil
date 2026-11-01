import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripeClient";
import { DASH_COOKIE, dashCookieValid } from "@/lib/dashAuth";
import { EDITABLE, EMAIL_RE, EMAIL_TABLES, emailVariants, findAuthUser, logAdmin } from "@/lib/adminMembers";
import { maskEmail } from "@/lib/adminReports";

// Owner dashboard: change a member (2 Nov 2026). Edit details, cancel or
// resume their membership through Stripe, or delete everything we hold.
// Only for the owner: the dashboard password cookie is checked on every call.

type Sub = {
  id: string;
  email: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: NextRequest) {
  if (!(await dashCookieValid(req.cookies.get(DASH_COOKIE)?.value))) return fail("Please log in to the dashboard again.", 401);
  // Same-site requests only (the cookie is SameSite=Lax too).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail("Not allowed.", 403);
  const db = supabaseAdmin;
  if (!db) return fail("The database isn't connected.", 500);

  const b = await req.json().catch(() => null);
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return fail("Which member?");
  const { data: subRow } = await db.from("subscribers").select("id, email, status, stripe_customer_id, stripe_subscription_id, current_period_end").eq("id", id).maybeSingle();
  const sub = subRow as Sub | null;
  if (!sub) return fail("That member wasn't found. They may have been deleted already.", 404);
  const live = sub.status === "active" || sub.status === "past_due";

  switch (b?.action) {
    case "update": {
      const fields = (b.fields ?? {}) as Record<string, unknown>;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === "email") continue;
        const rule = EDITABLE[k];
        if (!rule) return fail(`"${k}" can't be edited here.`);
        const r = rule(v);
        if (!r.ok) return fail(r.message);
        clean[k] = r.value;
      }
      const changed = Object.keys(clean);
      if (changed.length) {
        const { error } = await db.from("subscribers").update(clean).eq("id", sub.id);
        if (error) return fail(`Couldn't save: ${error.message}`, 500);
      }

      // A new email moves everything we hold, their Stripe receipts and their sign-in.
      const newEmail = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : null;
      if (newEmail && newEmail !== sub.email.toLowerCase()) {
        if (!EMAIL_RE.test(newEmail)) return fail("That email doesn't look right.");
        const { data: taken } = await db.from("subscribers").select("id").ilike("email", newEmail.replace(/[%_\\]/g, "\\$&")).limit(1);
        if (taken && taken.length) return fail("Another member already uses that email. Sort that one out first.");
        const olds = await emailVariants(db, sub.email);
        const failed: string[] = [];
        for (const t of EMAIL_TABLES) {
          const { error } = await db.from(t).update({ email: newEmail }).in("email", olds);
          if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(t);
        }
        if (failed.length) return fail(`The email changed in some places but not ${failed.join(", ")}. Try again.`, 500);
        if (stripe && sub.stripe_customer_id) {
          try { await stripe.customers.update(sub.stripe_customer_id, { email: newEmail }); } catch (e) { console.error("admin email: stripe", (e as Error).message); }
        }
        const user = await findAuthUser(db, sub.email);
        if (user) {
          const { error } = await db.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true });
          if (error) console.error("admin email: auth", error.message);
        }
        changed.push("email");
      }
      if (!changed.length) return fail("Nothing to change.");
      await logAdmin(db, "edit", newEmail ?? sub.email, { fields: changed });
      return NextResponse.json({ ok: true, message: "Saved." });
    }

    case "cancel": {
      if (!live) return fail("This membership isn't active.");
      if (!sub.stripe_subscription_id) return fail("This one has no Stripe subscription (a once-off payment), so there's nothing to cancel.");
      if (!stripe) return fail("Stripe isn't connected, so it can't be cancelled from here. Cancel it in Stripe.", 500);
      const now = b.when === "now";
      try {
        if (now) await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        else await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      } catch (e) {
        return fail(`Stripe said no: ${(e as Error).message}`, 502);
      }
      // Stripe's webhook will confirm this; record it now so the page is right straight away.
      const patch = now
        ? { status: "canceled", canceled_at: new Date().toISOString(), cancel_comment: "Cancelled by Utilo" }
        : { cancel_at: sub.current_period_end, canceled_at: new Date().toISOString(), cancel_comment: "Cancelled by Utilo" };
      const { error } = await db.from("subscribers").update(patch).eq("id", sub.id);
      if (error && /column|schema cache/i.test(error.message) && now) await db.from("subscribers").update({ status: "canceled" }).eq("id", sub.id);
      await logAdmin(db, now ? "cancel_now" : "cancel_at_period_end", sub.email);
      return NextResponse.json({ ok: true, message: now ? "Cancelled. They won't be charged again." : "Set to end when their paid period runs out. They won't be charged again." });
    }

    case "resume": {
      if (!live || !sub.stripe_subscription_id) return fail("There's nothing to resume.");
      if (!stripe) return fail("Stripe isn't connected.", 500);
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
      } catch (e) {
        return fail(`Stripe said no: ${(e as Error).message}`, 502);
      }
      await db.from("subscribers").update({ cancel_at: null, canceled_at: null, cancel_comment: null }).eq("id", sub.id);
      await logAdmin(db, "resume", sub.email);
      return NextResponse.json({ ok: true, message: "Their membership will carry on as normal." });
    }

    case "delete": {
      if (b.confirm !== "DELETE") return fail("Type DELETE to confirm.");
      // Billing stops first, so nobody is charged for an account that's gone.
      if (live && sub.stripe_subscription_id) {
        if (!stripe) return fail("Stripe isn't connected, so their billing can't be stopped from here. Cancel it in Stripe first.", 500);
        try {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        } catch (e) {
          const msg = (e as Error).message;
          if (!/No such subscription|canceled/i.test(msg)) return fail(`Couldn't cancel their billing in Stripe, so nothing was deleted: ${msg}`, 502);
        }
      }
      const emails = await emailVariants(db, sub.email);
      const failed: string[] = [];
      for (const t of EMAIL_TABLES) {
        const { error } = await db.from(t).delete().in("email", emails);
        if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(t);
      }
      // Free bill-photo reads keyed by the email they gave for a result.
      const { error: readErr } = await db.from("bill_reads").delete().in("lead_email", emails);
      if (readErr && !/does not exist|schema cache|column/i.test(readErr.message)) failed.push("bill_reads");
      if (failed.length) return fail(`Billing is stopped, but some data couldn't be deleted (${failed.join(", ")}). Press delete again to finish.`, 500);
      const user = await findAuthUser(db, sub.email);
      if (user) {
        const { error } = await db.auth.admin.deleteUser(user.id);
        if (error) console.error("admin delete: auth", error.message);
      }
      // The log keeps a masked address only: the point of deleting is that we don't keep it.
      await logAdmin(db, "delete", maskEmail(sub.email.toLowerCase()), { stripe_customer: sub.stripe_customer_id });
      return NextResponse.json({ ok: true, message: "Deleted. Their payment records stay in Stripe, which must keep them by law." });
    }

    default:
      return fail("Unknown action.");
  }
}
