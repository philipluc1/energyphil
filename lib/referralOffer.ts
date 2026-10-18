// "Give $7, get $7": the referral offer, in one place (shown in the dashboard,
// on the home and check pages for referred visitors, in the terms and FAQ).
// The friend gets this much off their first payment; the member who sent them
// gets the same as a credit on their next payment, once the friend has paid.

export const REFERRAL_FRIEND_CENTS = 700;
export const REFERRAL_CREDIT_CENTS = 700;
/** Stripe coupon id; created automatically the first time it's needed. */
export const REFERRAL_COUPON_ID = "utilo-friend-7";

export const referralDollars = (cents: number) => `$${(cents / 100).toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
