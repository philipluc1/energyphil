// Does the postcode exist, and does the suburb sit in it?
//
// A wrong postcode can put a customer on the wrong network and so the wrong
// prices. The suburb list (lib/vicLocalities.ts, loaded on demand) lets the
// check page offer only the suburbs in the postcode typed, and catch a saved
// or bill-read suburb that belongs to a different postcode.

export type Localities = Record<string, string>; // postcode -> "Suburb|Suburb"

export type LocalityCheck =
  | { status: "incomplete" } // fewer than 4 digits, or the list isn't loaded
  | { status: "poBox" } // 8xxx: PO Box and large-volume postcodes, never a street address
  | { status: "unknown" } // 4 digits, Victorian-looking, but no suburbs use it
  | { status: "needSuburb"; suburbs: string[] }
  | { status: "mismatch"; suburbs: string[]; suburbPostcodes: string[] }
  | { status: "ok"; suburbs: string[]; suburb: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function suburbsIn(list: Localities, postcode: string): string[] {
  const v = list[postcode];
  return v ? v.split("|") : [];
}

/** Every postcode a suburb name appears in (a few names repeat across Victoria). */
export function postcodesFor(list: Localities, suburb: string): string[] {
  const want = norm(suburb);
  if (!want) return [];
  return Object.keys(list).filter((pc) => list[pc].split("|").some((s) => norm(s) === want));
}

export function checkLocality(list: Localities | null, postcode: string, suburb: string): LocalityCheck {
  if (!list || !/^\d{4}$/.test(postcode)) return { status: "incomplete" };
  if (postcode.startsWith("8")) return { status: "poBox" };
  const suburbs = suburbsIn(list, postcode);
  if (suburbs.length === 0) return { status: "unknown" };
  const s = suburb.trim();
  if (!s) return { status: "needSuburb", suburbs };
  const hit = suburbs.find((x) => norm(x) === norm(s));
  if (hit) return { status: "ok", suburbs, suburb: hit };
  const elsewhere = postcodesFor(list, s);
  // A suburb we don't know at all (new estate, spelling) isn't treated as wrong.
  return elsewhere.length > 0 ? { status: "mismatch", suburbs, suburbPostcodes: elsewhere } : { status: "ok", suburbs, suburb: s };
}
