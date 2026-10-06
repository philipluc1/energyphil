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

export interface TimelineItem {
  when: string;
  title: string;
  detail: string;
  status: "done" | "expected";
}
export const TIMELINE: TimelineItem[] = [
  { when: "14 Nov 2025", title: "ESC asks for comment", detail: "The regulator publishes a paper and asks retailers and the public for input on 2026–27.", status: "done" },
  { when: "12 Mar 2026", title: "Draft decision", detail: "First look at the new default prices, followed by a public forum on 23 March.", status: "done" },
  { when: "20 May 2026", title: "Final decision", detail: "Residential prices fall by 5% on average: AusNet -8%, CitiPower, Jemena and Powercor -4%, United Energy -3%.", status: "done" },
  { when: "1 Jul 2026", title: "New default prices start", detail: "Prices run to 30 June 2027. Retailers update their own offers around the same time.", status: "done" },
  { when: "22 Sep 2026", title: "Utilo's latest plan data", detail: "135 plans from 15 retailers, pulled from retailers' published data.", status: "done" },
  { when: "About Nov 2026", title: "2027–28 review opens", detail: "Based on past years. The ESC has not published this timetable yet.", status: "expected" },
  { when: "About Mar 2027", title: "Draft decision", detail: "Expected on the same pattern as this year.", status: "expected" },
  { when: "About May 2027", title: "Final decision", detail: "Expected before the new prices start.", status: "expected" },
  { when: "1 Jul 2027", title: "New default prices start", detail: "The default offer is reset every 1 July.", status: "expected" },
];

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
