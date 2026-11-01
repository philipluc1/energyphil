// Retailer complaints badge (2 Nov 2026): how often each retailer's customers
// take a complaint to the Energy and Water Ombudsman Victoria (EWOV), per
// 10,000 customers, so a big retailer isn't punished for being big.
//
// Source: EWOV annual report "Company data" (cases per 10,000 customers for
// each scheme participant), https://www.ewov.com.au/reports/annual-report-2025
// and https://www.ewov.com.au/data-and-reports. Copy the figures in by hand
// from the latest year; never estimate one. A retailer with no figure shows no
// badge. The list is still ranked by price: this is information, not a score.

export const COMPLAINTS_SOURCE = {
  name: "Energy and Water Ombudsman Victoria (EWOV)",
  short: "EWOV",
  /** The financial year the figures cover, e.g. "2025–26". Empty until filled. */
  period: "",
  url: "https://www.ewov.com.au/data-and-reports",
};

/** EWOV cases per 10,000 customers, by retailer name as it appears in our plan data. */
export const CASES_PER_10K: Record<string, number> = {
  // "Example Energy": 12.3,
};

export type ComplaintBand = "low" | "average" | "high";

export interface ComplaintInfo {
  band: ComplaintBand;
  rate: number;
  /** The middle rate across the retailers we have figures for. */
  median: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Below three-quarters of the middle is "low", above a third over it is "high". */
export function complaintBand(retailer: string, table: Record<string, number> = CASES_PER_10K): ComplaintInfo | null {
  const rate = table[retailer];
  const all = Object.values(table).filter((x) => Number.isFinite(x) && x >= 0);
  if (rate === undefined || !Number.isFinite(rate) || all.length < 5) return null;
  const mid = median(all);
  const band: ComplaintBand = rate <= mid * 0.75 ? "low" : rate >= mid * (4 / 3) ? "high" : "average";
  return { band, rate, median: mid };
}

/** A plain Google search for the retailer's reviews: we link out, we don't copy ratings. */
export function reviewsUrl(retailer: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${retailer} energy reviews`)}`;
}
