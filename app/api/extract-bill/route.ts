import { NextRequest, NextResponse } from "next/server";
import { sanitizeExtractedBill } from "@/lib/billExtraction";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Each read costs us an AI call. Members get 10 a day; everyone else gets a
// couple a day per connection, enough to try it for real before joining.
const MAX_READS_PER_DAY = 10;
const FREE_READS_PER_DAY = 2;
// Total free (visitor) reads per day across the whole site. Raise it as traffic grows.
const FREE_READS_ALL_VISITORS_PER_DAY = Number(process.env.FREE_READS_PER_DAY_TOTAL ?? 300);

// Vision calls can take a few seconds; give it more room than the default.
export const maxDuration = 30;

// The browser resizes photos to ~1600px before upload (see BillPhotoUpload.tsx),
// so a real submission should be well under this — this just guards against a
// stray huge file wasting an API call. PDFs aren't resized client-side, so the
// cap is a bit higher to allow for a multi-page scanned bill.
const MAX_BYTES = 15 * 1024 * 1024;

// Cheapest current vision-capable model. Swap this for a Sonnet model string
// if extraction accuracy turns out to need it — one line, higher cost per scan.
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const TOOL_SCHEMA = {
  name: "extract_bill_fields",
  description: "Extract structured billing data from a photo, PDF or screenshot of an Australian residential electricity, gas or dual-fuel bill, or a screenshot of the customer's plan and rates in their retailer's app or online account.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_electricity_bill: {
        type: "boolean",
        description:
          "True if the image shows a residential electricity bill, a dual-fuel bill that includes electricity, or a retailer app/account screen showing the customer's electricity plan, rates or usage. False for a gas-only bill, receipt or unrelated photo.",
      },
      fuel: {
        type: ["string", "null"],
        enum: ["electricity", "gas", "dual", null],
        description: "Which fuel the bill covers: electricity only, gas only, or dual (both on one bill).",
      },
      gas_distributor: {
        type: ["string", "null"],
        enum: ["Australian Gas Networks", "Multinet", "AusNet Services", null],
        description: "For a bill with gas: the gas distribution network named on it, mapped to one of these three Victorian networks. Null if not shown.",
      },
      gas_billing_days: { type: ["integer", "null"], description: "For a bill with gas: days in the gas billing period." },
      gas_mj: { type: ["number", "null"], description: "For a bill with gas: total gas usage for the period in megajoules (MJ). Convert from kWh if needed (1 kWh = 3.6 MJ)." },
      gas_bill_total: { type: ["number", "null"], description: "For a bill with gas: the gas charges for the period including GST, in AUD. On a dual bill, the gas portion only." },
      gas_plan_name: { type: ["string", "null"], description: "For a bill with gas: the gas plan or offer name printed on the bill." },
      distributor: {
        type: ["string", "null"],
        enum: ["Citipower", "Powercor", "United Energy", "Jemena", "AusNet Services", null],
        description:
          "The electricity network/distributor named on the bill — labelled 'Distributor' or 'Network', NOT the retailer. Null if not one of these five Victorian networks or not visible.",
      },
      retailer_name: {
        type: ["string", "null"],
        description: "The retailer/company name the bill is from (e.g. 'AGL', 'Origin Energy'). For display only.",
      },
      billing_days: {
        type: ["integer", "null"],
        description: "Number of days in the billing period shown on the bill.",
      },
      nmi: {
        type: ["string", "null"],
        description: "The National Metering Identifier (NMI), a 10-11 character code, usually starting with 6 for Victoria. Null if not visible.",
      },
      plan_name: {
        type: ["string", "null"],
        description: "The name of the customer's current plan or offer as printed on the bill (e.g. 'Value Saver', 'Standing Offer'). Null if not shown.",
      },
      tariff_type: {
        type: ["string", "null"],
        enum: ["single_rate", "time_of_use", "demand", "flexible", null],
        description: "How usage is charged: one flat rate (single_rate), peak/shoulder/off-peak bands (time_of_use), a demand charge (demand), or another structure (flexible).",
      },
      current_bill_total: {
        type: ["number", "null"],
        description: "Total amount payable including GST, in AUD.",
      },
      usage_mode: {
        type: ["string", "null"],
        enum: ["simple", "detailed", null],
        description:
          "'simple' if the bill shows one total usage figure in kWh, 'detailed' if it breaks usage into peak/shoulder/off-peak time bands.",
      },
      anytime_kwh: { type: ["number", "null"], description: "Total usage in kWh, only when usage_mode is 'simple'." },
      peak_kwh: { type: ["number", "null"], description: "Peak-band usage in kWh, only when usage_mode is 'detailed'." },
      shoulder_kwh: { type: ["number", "null"], description: "Shoulder-band usage in kWh, if shown." },
      offpeak_kwh: {
        type: ["number", "null"],
        description: "Off-peak-band usage in kWh, only when usage_mode is 'detailed'.",
      },
      controlled_load_kwh: {
        type: ["number", "null"],
        description: "Separately metered controlled load / off-peak hot water usage in kWh, if shown.",
      },
      customer_name: {
        type: ["string", "null"],
        description: "The account holder's name as printed on the bill (e.g. next to 'Account name' or the mailing address block). Null if not visible.",
      },
      address: {
        type: ["string", "null"],
        description: "The supply address's street line (e.g. '12 Smith Street') — the property the electricity is supplied to, not a billing/mailing address if they differ. Null if not visible.",
      },
      suburb: {
        type: ["string", "null"],
        description: "The suburb of the supply address. Null if not visible.",
      },
      postcode: {
        type: ["string", "null"],
        description: "The 4-digit postcode of the supply address. Null if not visible.",
      },
      has_solar: {
        type: "boolean",
        description: "True if the bill shows any solar feed-in / solar export credit line item, even a small or zero-dollar one — this indicates the property has solar, regardless of the credit amount.",
      },
      solar_export_kwh: {
        type: ["number", "null"],
        description: "Total solar energy exported to the grid in kWh for this billing period, if a feed-in/export line item is shown. Null if there's no solar or the figure isn't shown.",
      },
      price_type: {
        type: ["string", "null"],
        enum: ["fixed", "variable", null],
        description:
          "Whether the electricity prices on this plan are fixed or variable. 'fixed' if the bill says the rates are fixed, locked, a 'rate fix' or 'price guarantee', or guaranteed until a date. 'variable' if it says variable rates or that prices may change. Null if the bill doesn't say.",
      },
      price_fixed_until: { type: ["string", "null"], description: "If prices are fixed, the date they're fixed until, as YYYY-MM-DD. Null otherwise." },
      discount_ends: {
        type: ["string", "null"],
        description: "If the bill says a discount, pay-on-time discount, sign-up credit or 'benefit period' ends on a date, that date as YYYY-MM-DD. Null if not shown.",
      },
      rates_include_gst: {
        type: ["boolean", "null"],
        description: "True if the unit rates and supply charge printed on the bill include GST, false if they are shown excluding GST (GST added as a separate line). Null if unclear.",
      },
      supply_charge_cents_per_day: { type: ["number", "null"], description: "Electricity daily supply charge in cents per day, exactly as printed (e.g. 125.5). Null if not shown." },
      anytime_rate_cents: { type: ["number", "null"], description: "Single/flat usage rate in cents per kWh as printed. If usage is stepped into blocks, the first block's rate. Null for time-of-use plans." },
      peak_rate_cents: { type: ["number", "null"], description: "Peak usage rate in cents per kWh as printed. Null if not a time-of-use plan." },
      shoulder_rate_cents: { type: ["number", "null"], description: "Shoulder usage rate in cents per kWh as printed, if shown." },
      offpeak_rate_cents: { type: ["number", "null"], description: "Off-peak usage rate in cents per kWh as printed, if shown." },
      controlled_load_rate_cents: { type: ["number", "null"], description: "Controlled load / dedicated circuit rate in cents per kWh as printed, if shown." },
      solar_fit_cents: { type: ["number", "null"], description: "Solar feed-in tariff in cents per kWh as printed, if shown." },
      warnings: {
        type: "array",
        items: { type: "string" },
        description:
          "Short plain-English notes about anything unclear, unreadable, missing, or guessed at. Empty array if everything was clear.",
      },
    },
    required: ["is_electricity_bill", "warnings"],
  },
};

export async function POST(req: NextRequest) {
  // Members get a generous daily cap; visitors get a free taste, capped per
  // connection so the AI cost stays bounded. Both counted in bill_reads.
  const member = await requireActiveMember(req.headers.get("authorization"));
  const rawIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  // IPv6 users can rotate addresses inside their /64, so count the /64.
  const ip = rawIp.includes(":") ? rawIp.split(":").slice(0, 4).join(":") + "::/64" : rawIp;
  const key = member.ok ? member.email : `ip:${ip}`;
  const cap = member.ok ? MAX_READS_PER_DAY : FREE_READS_PER_DAY;
  // Without the database we can't count, so only members (who need it anyway) get through.
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, message: "Photo reading isn't available right now. Type the numbers in below." }, { status: 503 });
  }
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // Record first, then count (this read included), so a burst of parallel
  // uploads can't all slip under the limit.
  await supabaseAdmin.from("bill_reads").insert({ email: key });
  const { count } = await supabaseAdmin
    .from("bill_reads")
    .select("id", { count: "exact", head: true })
    .eq("email", key)
    .gte("created_at", since);
  if ((count ?? 0) > cap) {
    return NextResponse.json(
      {
        ok: false,
        message: member.ok
          ? `You've hit today's limit of ${MAX_READS_PER_DAY} bill reads. Try again tomorrow, or type the numbers in.`
          : `That's today's ${FREE_READS_PER_DAY} free bill reads. Members can read up to ${MAX_READS_PER_DAY} a day, or type the numbers in below.`,
      },
      { status: 429 },
    );
  }
  // A ceiling on free reads across everyone, so AI costs can't run away.
  if (!member.ok) {
    const { count: allFree } = await supabaseAdmin
      .from("bill_reads")
      .select("id", { count: "exact", head: true })
      .like("email", "ip:%")
      .gte("created_at", since);
    if ((allFree ?? 0) > FREE_READS_ALL_VISITORS_PER_DAY) {
      return NextResponse.json({ ok: false, message: "Free photo reading is busy today. Type the numbers in below, or try tomorrow." }, { status: 429 });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "Photo reading isn't switched on yet — enter your details manually below." },
      { status: 200 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Couldn't read that upload — please try again." }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file received." }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, message: "That doesn't look like an image or PDF file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, message: "That file's too large — try a smaller photo, or a shorter PDF." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  // Claude reads a PDF as a "document" content block (it handles the pages
  // itself — no server-side rasterizing needed) and a photo as an "image"
  // block. If PDF reads start erroring out, the model above is the first
  // thing to try bumping to a newer/larger one.
  const contentBlock = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64 } };

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "extract_bill_fields" },
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text:
                  `This is a ${isPdf ? "PDF" : "photo"} of an Australian residential energy bill (electricity, gas or both). Read it ` +
                  "carefully and call extract_bill_fields with your best-effort reading. Leave a field null " +
                  "rather than guessing if it isn't clearly shown, and note anything uncertain in warnings. " +
                  "Victorian distributor names can appear with extra wording (e.g. 'CitiPower', 'Jemena " +
                  "Electricity Networks') — map them to the closest of the five listed options, or null if it's " +
                  "clearly a different network. Also read the account holder's name and the supply address " +
                  "(street/suburb/postcode) if printed, and check for any solar feed-in/export credit line — " +
                  "set has_solar true whenever one appears, even if the credit is $0 or very small. If the bill includes gas, fill the gas_* fields " +
                  "(usage in MJ, days, gas charges, gas network) and set fuel accordingly.",
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Couldn't reach the bill reader — please try again shortly." },
      { status: 502 },
    );
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic API error", anthropicRes.status, errText);
    return NextResponse.json(
      { ok: false, message: "The bill reader had a problem — please try again, or enter your details manually." },
      { status: 502 },
    );
  }

  const data = await anthropicRes.json();
  const content: Array<{ type?: string; input?: unknown }> = Array.isArray(data?.content) ? data.content : [];
  const toolUse = content.find((block) => block?.type === "tool_use");

  if (!toolUse?.input) {
    return NextResponse.json(
      {
        ok: false,
        message: `Couldn't make sense of that ${isPdf ? "PDF" : "photo"} — please try a clearer one or enter details manually.`,
      },
      { status: 200 },
    );
  }

  const extracted = sanitizeExtractedBill(toolUse.input);

  if (!extracted.isElectricityBill && extracted.fuel !== "gas") {
    return NextResponse.json(
      {
        ok: false,
        message: "That doesn't look like an energy bill — try another file, or enter your details manually below.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, extracted });
}
