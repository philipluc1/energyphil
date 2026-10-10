import { PLAN_DATA_DATE, PLANS } from "./plans";

/** Plain-English facts about where prices come from and how often things run.
 *  Keep this honest: it is shown on the home page and the Learn page. */
/** Shown wherever a saving or a switch is mentioned. Retailers reprice all
 *  year, so a cheaper plan can appear soon after someone switches. */
export const PRICE_CHANGE_CLAUSE =
  "Offers and prices change constantly. A plan that's cheapest today may not be next month, and a cheaper one can appear soon after you switch. That's normal, not a mistake. We only suggest switching again when the saving is worth the effort.";

/** Don't nag: a new plan has to beat the current one by this much a year. */
export const WORTH_SWITCHING_PER_YEAR = 50;
/** After a confirmed switch, hold alerts for this long unless the saving is big. */
export const QUIET_DAYS_AFTER_SWITCH = 60;
export const BIG_SAVING_PER_YEAR = 150;

export const DATA_FACTS = {
  source:
    "Each retailer publishes its current plans and rates in a standard public data feed under Australia's Consumer Data Right. We read those feeds directly, so the numbers come from the retailer, not typed in by hand.",
  lastPull: new Date(PLAN_DATA_DATE + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
  planCount: PLANS.length,
  retailerCount: new Set(PLANS.map((p) => p[0])).size,
  // What actually runs, and when (Melbourne time). Vercel crons in vercel.json.
  memberRecheck: "Every morning, each member's home is re-priced against every plan we track on their network.",
  monthlyEmail: "On the 1st of each month, members get a summary of what changed and what they're saving.",
  defaultOffer: "The default offer (VDO) is updated each 1 July from the Essential Services Commission's final decision.",
  howPriced:
    "We price every plan the same way: daily supply charge × days, plus each rate × the kWh used in that time band, plus controlled load, minus any solar credit. Nothing is weighted or sponsored.",
  notIncluded: "Sign-up credits, conditional discounts, exit fees, concessions and rebates. We tell you to confirm with the retailer before switching.",
};

/** When the verdict turns red rather than a warm "you could pay less":
 *  the cheapest plan saves at least this much a year, or this share of the bill. */
export const OVERPRICED_PER_YEAR = 300;
export const OVERPRICED_SHARE = 0.2;
