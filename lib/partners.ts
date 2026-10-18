// Partners who send people to Utilo with their own link: utilo.com.au/p/<code>.
// Add a partner here (and redeploy) to switch their link on. The welcome line
// shows at the top of the home page and the check for people who arrive
// through it; the owner dashboard counts their checks and members.
//
// Codes: lower-case letters, digits and dashes. Use only real partners who
// have agreed to it; never imply an endorsement a partner hasn't given.

export interface Partner {
  code: string;
  /** Shown to visitors: "Welcome, <name> members". */
  name: string;
  /** Optional line under the welcome. */
  welcome?: string;
}

const LIVE: Partner[] = [
  // { code: "example-energy-group", name: "Example Community Energy Group", welcome: "Your group's link: the free check is below." },
];

// A made-up partner for local testing only. Never live.
const TESTING: Partner[] =
  process.env.NODE_ENV === "production"
    ? []
    : [{ code: "sample", name: "Sample Community Group", welcome: "This is a test partner link (local testing only)." }];

export const PARTNERS: Partner[] = [...LIVE, ...TESTING];

export function findPartner(code: string | null | undefined): Partner | null {
  if (!code) return null;
  const c = code.toLowerCase();
  return PARTNERS.find((p) => p.code === c) ?? null;
}

export const partnerName = (code: string) => findPartner(code)?.name ?? null;
