import { Distributor } from "./plans";

// Best-effort postcode -> distributor lookup, used only to pre-fill a guess
// on step 1 of /check — never the final word. Victoria's energy regulator is
// explicit that distribution boundaries are drawn on a literal GIS map, not
// along postcode lines (energy.vic.gov.au/households/find-your-energy-distributor
// points people to an interactive map, not a postcode list), so some postcodes
// genuinely straddle two distributors — a handful of streets in a growth-corridor
// postcode can be serviced by a different network than the rest of it. For that
// reason this table is deliberately NOT exhaustive: it only covers postcodes
// that sit solidly in the middle of one distributor's well-known general area
// (per each distributor's own published service-area description), and returns
// null for anything else rather than guess. The UI always shows the full
// five-network picker right under the guess, pre-selected but fully editable,
// so an unmapped or wrong postcode costs the customer one extra click, never a
// wrong result.
const POSTCODE_DISTRIBUTOR: Record<string, Distributor> = {
  // --- CitiPower: Melbourne CBD and the inner core around it ---
  "3000": "Citipower", "3002": "Citipower", "3003": "Citipower", "3004": "Citipower",
  "3006": "Citipower", "3008": "Citipower", "3051": "Citipower", "3053": "Citipower",
  "3054": "Citipower", "3065": "Citipower", "3066": "Citipower", "3067": "Citipower",
  "3068": "Citipower", "3121": "Citipower", "3141": "Citipower", "3142": "Citipower",
  "3143": "Citipower", "3181": "Citipower", "3182": "Citipower", "3183": "Citipower",
  "3205": "Citipower", "3206": "Citipower", "3207": "Citipower",

  // --- Jemena: northern and north-western Melbourne ---
  "3013": "Jemena", "3015": "Jemena", "3016": "Jemena",
  "3018": "Jemena", "3019": "Jemena", "3020": "Jemena", "3021": "Jemena",
  "3032": "Jemena", "3033": "Jemena", "3038": "Jemena", "3039": "Jemena",
  "3040": "Jemena", "3041": "Jemena", "3042": "Jemena", "3043": "Jemena",
  "3046": "Jemena", "3047": "Jemena", "3055": "Jemena", "3056": "Jemena",
  "3057": "Jemena", "3058": "Jemena", "3060": "Jemena", "3064": "Jemena",
  "3072": "Jemena", "3073": "Jemena",

  // --- Powercor: western Melbourne suburbs and all of western/central Victoria ---
  "3011": "Powercor", "3012": "Powercor", "3022": "Powercor", "3023": "Powercor",
  "3024": "Powercor", "3025": "Powercor", "3026": "Powercor", "3027": "Powercor",
  "3028": "Powercor", "3029": "Powercor", "3030": "Powercor", "3031": "Powercor",
  "3036": "Powercor", "3337": "Powercor", "3338": "Powercor", "3340": "Powercor",
  "3350": "Powercor", "3352": "Powercor", "3353": "Powercor", "3216": "Powercor",
  "3220": "Powercor", "3280": "Powercor", "3300": "Powercor", "3400": "Powercor",
  "3450": "Powercor", "3465": "Powercor",

  // --- United Energy: south-eastern Melbourne and the Mornington Peninsula ---
  "3101": "United Energy", "3102": "United Energy", "3103": "United Energy",
  "3104": "United Energy", "3105": "United Energy",
  "3145": "United Energy", "3146": "United Energy", "3147": "United Energy",
  "3148": "United Energy", "3149": "United Energy", "3150": "United Energy",
  "3151": "United Energy", "3152": "United Energy", "3161": "United Energy",
  "3162": "United Energy", "3163": "United Energy", "3165": "United Energy",
  "3166": "United Energy", "3167": "United Energy", "3168": "United Energy",
  "3170": "United Energy", "3171": "United Energy", "3172": "United Energy",
  "3173": "United Energy", "3174": "United Energy", "3175": "United Energy",
  "3176": "United Energy", "3177": "United Energy", "3178": "United Energy",
  "3179": "United Energy", "3188": "United Energy", "3189": "United Energy",
  "3190": "United Energy", "3191": "United Energy", "3192": "United Energy",
  "3193": "United Energy", "3194": "United Energy", "3195": "United Energy",
  "3196": "United Energy", "3197": "United Energy", "3198": "United Energy",
  "3199": "United Energy", "3200": "United Energy", "3201": "United Energy",
  "3204": "United Energy", "3930": "United Energy", "3931": "United Energy",
  "3934": "United Energy", "3936": "United Energy", "3940": "United Energy",
  "3942": "United Energy", "3943": "United Energy", "3944": "United Energy",

  // --- AusNet Services: outer northern/eastern Melbourne and eastern Victoria ---
  "3070": "AusNet Services", "3071": "AusNet Services", "3078": "AusNet Services",
  "3081": "AusNet Services", "3082": "AusNet Services", "3083": "AusNet Services",
  "3084": "AusNet Services", "3087": "AusNet Services", "3088": "AusNet Services",
  "3093": "AusNet Services", "3094": "AusNet Services", "3095": "AusNet Services",
  "3096": "AusNet Services", "3097": "AusNet Services", "3099": "AusNet Services",
  "3108": "AusNet Services", "3109": "AusNet Services", "3111": "AusNet Services",
  "3113": "AusNet Services", "3114": "AusNet Services", "3115": "AusNet Services",
  "3116": "AusNet Services", "3123": "AusNet Services", "3124": "AusNet Services",
  "3125": "AusNet Services", "3126": "AusNet Services", "3127": "AusNet Services",
  "3128": "AusNet Services", "3129": "AusNet Services", "3130": "AusNet Services",
  "3131": "AusNet Services", "3132": "AusNet Services", "3133": "AusNet Services",
  "3134": "AusNet Services", "3135": "AusNet Services", "3136": "AusNet Services",
  "3137": "AusNet Services", "3138": "AusNet Services", "3139": "AusNet Services",
  "3140": "AusNet Services", "3153": "AusNet Services", "3154": "AusNet Services",
  "3155": "AusNet Services", "3156": "AusNet Services", "3159": "AusNet Services",
  "3160": "AusNet Services", "3752": "AusNet Services", "3754": "AusNet Services",
  "3755": "AusNet Services", "3756": "AusNet Services", "3775": "AusNet Services",
  "3777": "AusNet Services", "3780": "AusNet Services", "3781": "AusNet Services",
  "3782": "AusNet Services", "3785": "AusNet Services", "3786": "AusNet Services",
  "3787": "AusNet Services", "3788": "AusNet Services", "3791": "AusNet Services",
  "3792": "AusNet Services", "3793": "AusNet Services", "3795": "AusNet Services",
  "3796": "AusNet Services", "3797": "AusNet Services", "3799": "AusNet Services",
  "3800": "AusNet Services", "3802": "AusNet Services", "3803": "AusNet Services",
  "3804": "AusNet Services", "3805": "AusNet Services", "3806": "AusNet Services",
  "3910": "AusNet Services", "3911": "AusNet Services", "3912": "AusNet Services",
  "3915": "AusNet Services", "3920": "AusNet Services", "3975": "AusNet Services",
  "3977": "AusNet Services", "3978": "AusNet Services", "3980": "AusNet Services",
  "3995": "AusNet Services",
};

export function guessDistributorFromPostcode(postcode: string): Distributor | null {
  const trimmed = postcode.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  return POSTCODE_DISTRIBUTOR[trimmed] ?? null;
}
