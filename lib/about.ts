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
  businessName: "",         // registered business or company name, e.g. "Utilo Pty Ltd"
  abn: "",                  // e.g. "12 345 678 901"
  location: "",             // e.g. "Melbourne, Victoria"
  contactEmail: "",         // general contact, e.g. "hello@utiloaustralia.com.au"
  postalAddress: "",        // optional, for written privacy requests
};

/** Privacy-policy specifics. */
export const PRIVACY = {
  /** Where privacy requests and complaints go, e.g. "privacy@utiloaustralia.com.au". */
  email: "",
  /** Last date the policy text was changed. Update when you edit app/privacy/page.tsx. */
  lastUpdated: "18 October 2026",
  /** The Supabase project's region (Supabase > Project Settings > General), e.g. "Sydney, Australia". */
  databaseRegion: "",
  /** How long member data is kept after a membership ends, e.g. "12 months". */
  memberRetention: "",
  /** How quickly you'll respond to access, correction and deletion requests. */
  responseDays: 30,
  /** IP records used to limit free bill reads are deleted after this many days (see the daily job). */
  billReadRetentionDays: 30,
};

export const hasFounderStory = Boolean(ABOUT.founderName && ABOUT.story.length > 0);
