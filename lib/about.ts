// Who's behind Utilo, and the business details the site and policies quote.
// Fill these in and they appear across the site: the home page "Why I built
// this" section, the footer, the Privacy Policy and the Terms.
// Anything left empty shows as a highlighted [placeholder] on the policy
// pages (so it's obvious what's missing) and is simply hidden elsewhere.
//
// photo: put a square-ish photo in public/images/ (e.g. public/images/phil.jpg)
// and set photo to "/images/phil.jpg".

export const ABOUT = {
  founderName: "",          // e.g. "Phil Luc"
  founderRole: "Founder",
  photo: "",                // e.g. "/images/phil.jpg"
  /** A few short paragraphs in your own words: why you built it, what you found. */
  story: [] as string[],
  businessName: "Utilo",    // registered business name (sole trader); legal name can be added, e.g. "Philip Luc trading as Utilo"
  abn: "73 133 514 035",
  location: "Point Cook, Victoria",
  contactEmail: "info@utilo.com.au",
  postalAddress: "PO Box 6355, Point Cook VIC 3030",
  /** Social pages, full links. Filled ones tell Google they're the same business (2 Nov 2026). */
  socials: {
    facebook: "",           // e.g. "https://www.facebook.com/utilo.au"
    instagram: "",          // e.g. "https://www.instagram.com/utilo.au"
    tiktok: "",             // e.g. "https://www.tiktok.com/@utilo.au"
  },
};

/** Privacy-policy specifics. */
export const PRIVACY = {
  /** Where privacy requests and complaints go, e.g. "privacy@utilo.com.au". */
  email: "info@utilo.com.au",
  /** Last date the policy text was changed. Update when you edit app/privacy/page.tsx. */
  lastUpdated: "5 November 2026",
  /** The Supabase project's region (Supabase > Project Settings > General), e.g. "Sydney, Australia". */
  databaseRegion: "",
  /** How long member data is kept after a membership ends, e.g. "12 months". */
  memberRetention: "12 months",
  /** The same, in days: the morning job deletes an ended membership's data this long after it ends (4 Nov 2026). */
  memberRetentionDays: 365,
  /** How quickly you'll respond to access, correction and deletion requests. */
  responseDays: 30,
  /** IP records used to limit free bill reads are deleted after this many days (see the daily job). */
  billReadRetentionDays: 30,
  /** The free photo allowance (a random device ID, or the email given for more free reads, with the date and fuel) is kept this long. */
  freeAllowanceDays: 400,
};

export const hasFounderStory = Boolean(ABOUT.founderName && ABOUT.story.length > 0);
