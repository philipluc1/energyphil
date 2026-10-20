// Content for the /learn page. Edit here, not in the page.

export interface LearnVideo {
  id: string;
  title: string;
  blurb: string;
  length: string;
  /** Paste a YouTube video id (the part after v=) once the video is published. */
  youtubeId?: string;
}

export const VIDEOS: LearnVideo[] = [
  { id: "how", title: "How Utilo works in 90 seconds", blurb: "From a few taps about your home to your cheapest plan.", length: "1:30" },
  { id: "bill", title: "Reading your electricity bill", blurb: "Where to find your network, usage and rates.", length: "3:00" },
  { id: "vdo", title: "The default offer, explained", blurb: "What the VDO is and why it changes every July.", length: "2:30" },
];

// Residential average change in the Victorian Default Offer, set by the
// Essential Services Commission (ESC). Sources: ESC final decisions.
// 2025-26 has no single published average in the sources used: it is the
// simple average of the five zone changes (+0.2, +0.3, +6.2, -1.6, +1.6).
export interface VdoYear {
  year: string;
  change: number;
  note: string;
}
export const VDO_HISTORY: VdoYear[] = [
  { year: "2023–24", change: 25, note: "Wholesale price spike. Average bill $1,403 to $1,755." },
  { year: "2024–25", change: -6, note: "Wholesale prices eased." },
  { year: "2025–26", change: 1.3, note: "About flat: -1.6% to +6.2% by network (simple average of zones)." },
  { year: "2026–27", change: -5, note: "Lower wholesale and network costs. About $84 less for an average household." },
];

/**
 * The default offer's yearly cycle, as four stages: when each happened last
 * time (2026–27) and when it's expected next (2027–28, following past years;
 * the ESC hasn't published that timetable yet). `nextIso` places "you are here".
 */
export interface CycleStage { title: string; detail: string; last: string; next: string; nextIso: string; confirmed: boolean }
export const PRICE_CYCLE: CycleStage[] = [
  { title: "Review opens", detail: "The ESC asks retailers and the public for input.", last: "14 Nov 2025", next: "About Nov 2026", nextIso: "2026-11-14", confirmed: false },
  { title: "Draft decision", detail: "A first look at next year's default prices.", last: "12 Mar 2026", next: "About Mar 2027", nextIso: "2027-03-12", confirmed: false },
  { title: "Final decision", detail: "The new default prices are set.", last: "20 May 2026", next: "About May 2027", nextIso: "2027-05-20", confirmed: false },
  { title: "New prices start", detail: "The default offer resets. Many retailers reprice their own plans around now too.", last: "1 Jul 2026", next: "1 Jul 2027", nextIso: "2027-07-01", confirmed: false },
];

/** Index of the next stage still to come (PRICE_CYCLE.length when all have passed). */
export function nextCycleStage(now = Date.now()): number {
  const i = PRICE_CYCLE.findIndex((s) => Date.parse(`${s.nextIso}T00:00:00+11:00`) > now);
  return i === -1 ? PRICE_CYCLE.length : i;
}

/** This year's default-offer change (1 July 2026), by network. ESC final decision, 20 May 2026. */
export const VDO_CHANGE_2026 = {
  from: "1 July 2026",
  average: -5,
  averageDollars: 84,
  byNetwork: [
    { network: "AusNet Services", change: -8 },
    { network: "CitiPower", change: -4 },
    { network: "Jemena", change: -4 },
    { network: "Powercor", change: -4 },
    { network: "United Energy", change: -3 },
  ],
};

export interface SaveTip {
  group: "Plan" | "Usage" | "Upgrades";
  title: string;
  body: string;
}
export const SAVE_TIPS: SaveTip[] = [
  { group: "Plan", title: "Check your plan every month", body: "Retailers change offers all year. A plan that was cheap last year may not be now." },
  { group: "Plan", title: "Compare more than the headline rate", body: "The daily supply charge matters as much as the cents per kWh." },
  { group: "Plan", title: "Match the plan to your day", body: "If you use most power at night, off-peak rates help. If you're home by day, a flat rate may win." },
  { group: "Plan", title: "Solar? Look at the feed-in rate", body: "What you're paid for exported power varies a lot between plans." },
  { group: "Usage", title: "Shift big jobs off-peak", body: "Dishwasher, washing and EV charging cost less outside the evening peak on a time-of-use plan." },
  { group: "Usage", title: "Heat and cool sensibly", body: "Around 18–20°C in winter and 25–26°C in summer. Heating and cooling are usually the biggest use." },
  { group: "Usage", title: "Hot water on a timer or controlled load", body: "Heating water overnight on a cheap circuit can cut that cost." },
  { group: "Usage", title: "Switch off standby", body: "TVs, consoles and chargers add up when left on." },
  { group: "Upgrades", title: "Ask about the Victorian Energy Upgrades program", body: "A government program that discounts efficient products such as heating, cooling and lighting. Check what's available for you." },
  { group: "Upgrades", title: "Check you're getting concessions", body: "If you hold an eligible concession card, you may be entitled to a Victorian energy concession. Check the Victorian Government's concessions page." },
  { group: "Upgrades", title: "Seal draughts, upgrade lighting", body: "Door seals and LED bulbs are cheap and pay back quickly." },
];
