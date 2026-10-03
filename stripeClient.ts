import "server-only";
import Stripe from "stripe";

// SERVER-ONLY. The secret key can create charges and must never reach the
// browser — the `server-only` import fails the build if a client component
// ever imports this file by mistake.
const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;
