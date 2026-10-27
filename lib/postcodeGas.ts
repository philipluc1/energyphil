import type { GasZone } from "./gasPlans";

// Best-effort postcode -> gas network, to pre-select the picker on the gas
// check. Like the electricity lookup (postcodeNetwork.ts) it is deliberately
// NOT exhaustive: only areas that sit solidly inside one network's published
// service area are listed, and anything else returns null. The picker always
// stays visible under the guess, so a wrong or unmapped postcode costs one
// click, never a wrong result. Network areas, as the distributors describe
// them: AusNet (gas) serves Melbourne's west and north; Multinet the east and
// south-east and the Yarra Ranges; Australian Gas Networks the inner south,
// bayside, the Mornington Peninsula and most regional centres.
const RANGES: [number, number, GasZone][] = [
  // AusNet Services: western and northern suburbs
  [3011, 3034, "AusNet Services"], // Footscray through to Altona, Sunshine, Laverton
  [3036, 3038, "AusNet Services"], // Keilor, Taylors Lakes
  [3042, 3049, "AusNet Services"], // Airport West, Glenroy, Broadmeadows
  [3064, 3064, "AusNet Services"], // Craigieburn
  [3074, 3076, "AusNet Services"], // Thomastown, Lalor, Epping
  [3337, 3338, "AusNet Services"], // Melton
  [3429, 3429, "AusNet Services"], // Sunbury
  [3029, 3030, "AusNet Services"], // Werribee, Hoppers Crossing
  // Multinet: eastern and south-eastern suburbs
  [3101, 3138, "Multinet"], // Kew, Hawthorn, Box Hill, Ringwood, Croydon
  [3140, 3140, "Multinet"], // Lilydale
  [3147, 3156, "Multinet"], // Ashburton, Glen Waverley, Wantirna, Knox
  [3170, 3180, "Multinet"], // Mulgrave, Noble Park, Dandenong
  [3802, 3810, "Multinet"], // Berwick, Narre Warren, Pakenham
  // Australian Gas Networks: inner south and bayside, the Peninsula, regional centres
  [3181, 3194, "Australian Gas Networks"], // St Kilda, Elwood, Brighton, Bentleigh
  [3195, 3199, "Australian Gas Networks"], // Mordialloc to Frankston
  [3204, 3207, "Australian Gas Networks"], // Caulfield, Port Melbourne
  [3930, 3944, "Australian Gas Networks"], // Mornington Peninsula
  [3214, 3228, "Australian Gas Networks"], // Geelong
  [3350, 3356, "Australian Gas Networks"], // Ballarat
  [3550, 3556, "Australian Gas Networks"], // Bendigo
  [3630, 3631, "Australian Gas Networks"], // Shepparton
  [3690, 3691, "Australian Gas Networks"], // Wodonga
  [3280, 3280, "Australian Gas Networks"], // Warrnambool
  [3500, 3500, "Australian Gas Networks"], // Mildura
];

export function guessGasZoneFromPostcode(postcode: string): GasZone | null {
  const n = parseInt(postcode, 10);
  if (!/^\d{4}$/.test(postcode) || Number.isNaN(n)) return null;
  for (const [lo, hi, zone] of RANGES) if (n >= lo && n <= hi) return zone;
  return null;
}
