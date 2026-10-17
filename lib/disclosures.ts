// Plain-English disclosures shown before a customer leaves for a retailer's
// site, and under results. One place to change the wording.

/**
 * Set to true the day Utilo takes any referral fee or commission from a
 * retailer. Every disclosure (pop-up, results, dashboard) then says so.
 * While false, the site can truthfully say it isn't paid by retailers.
 */
export const RECEIVES_RETAILER_FEES = false;

export function independenceLine(retailer?: string): string {
  const who = retailer ?? "a retailer";
  return RECEIVES_RETAILER_FEES
    ? `Utilo may receive a fee from ${who} if you sign up. It doesn't change the order of our results, which are ranked by price only.`
    : `We're not part of ${retailer ?? "any retailer"} and we aren't paid if you sign up.`;
}

/** Short label for the independence point. */
export function independenceLabel(): string {
  return RECEIVES_RETAILER_FEES ? "How we're paid." : "Independent.";
}

/** The general points, used under results and on the dashboard. */
export const GENERAL_DISCLOSURES: { title: string; body: string }[] = [
  {
    title: "Where the prices come from",
    body: "Retailers' published plans (their Consumer Data Right feeds, the same source as Energy Made Easy), checked every day. We cover the retailers we track, not every plan in the market.",
  },
  {
    title: "Estimates, not quotes",
    body: "Figures are worked out from your bill or your answers and include GST. Your real bills depend on how much power you use, the season and the retailer's terms.",
  },
  {
    title: "Conditions and availability",
    body: "We leave out conditional discounts, sign-up credits and fees. Some prices need conditions such as paying on time, direct debit, e-billing or a membership. Offers can change or close at any time, and you need to be eligible.",
  },
  {
    title: "Your decision",
    body: "This is general information, not financial advice. Check the offer and its Energy Fact Sheet with the retailer before you agree. In Victoria you can cancel a new energy contract within 10 business days (cooling-off).",
  },
];
