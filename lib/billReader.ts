import "server-only";
import { sanitizeExtractedBill, type ExtractedBill } from "./billExtraction";

// 5 Nov 2026: the bill reader in one place, so a photo or PDF uploaded on the site and a bill
// forwarded by email (app/api/inbound-bill) are read by exactly the same prompt and model.

// Cheapest current vision-capable model. Swap this for a Sonnet model string
// if extraction accuracy turns out to need it — one line, higher cost per scan.
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export type BillFile = { mediaType: string; base64: string };
export type ReadResult =
  | { ok: true; extracted: ExtractedBill & { pages: number } }
  | { ok: false; reason: "nokey" | "unreachable" | "api" | "unreadable" | "notbill" };

export const TOOL_SCHEMA = {
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
      gas_supply_cents_per_day: { type: ["number", "null"], description: "For a bill with gas: the daily supply (service) charge in cents per day including GST, e.g. 95.7. Null if not shown." },
      gas_usage_cents_per_mj: { type: ["number", "null"], description: "For a bill with gas: the usage rate in cents per MJ including GST, e.g. 3.85. If the bill has stepped rates, the first (highest-volume or first block) rate. Null if not shown." },
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
      period_end: { type: ["string", "null"], description: "The last day of the billing period, as YYYY-MM-DD (e.g. 'Billing period 1 Jun 2026 to 31 Aug 2026' gives 2026-08-31). Null if not shown." },
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
        description: "Total amount payable including GST, in AUD, as printed (it may include an overdue balance; new_charges_total is this period alone).",
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
      account_type: {
        type: ["string", "null"],
        enum: ["residential", "business", null],
        description:
          "Whether this is a residential (home) or business account. Look for wording such as 'Residential', 'Home', 'Business', 'Commercial', 'Small business', a business or company name as the account holder, or the customer's own ABN (not the retailer's ABN). Null if unclear.",
      },
      embedded_network: {
        type: "boolean",
        description:
          "True if the bill comes from an embedded network: the electricity is supplied through a building, apartment complex, retirement village, caravan park or shopping centre's private network, often billed by the owners corporation, strata manager or an embedded network operator, or the bill mentions 'embedded network', 'child meter' or 'parent meter'. False otherwise.",
      },
      has_demand_charge: {
        type: "boolean",
        description: "True if the bill includes a demand charge (priced in $ per kW or kVA, per day or per month). Some homes are on a demand tariff; it is also common on business tariffs.",
      },
      max_demand_kw: {
        type: ["number", "null"],
        description: "If there is a demand charge, the maximum demand it was charged on, in kW (e.g. 'Demand 3.2 kW', 'Max demand 2.85kW'). Convert kVA only if the bill shows kVA and no kW. Null if there is no demand charge or no figure is shown.",
      },
      reading_type: {
        type: ["string", "null"],
        enum: ["actual", "estimated", "mixed", null],
        description:
          "Whether the electricity meter reading(s) on this bill were actual or estimated. Look for 'Estimated read', 'Est.', an 'E' marker beside readings, or 'Actual read'. 'mixed' if some were estimated. Null if the bill doesn't say.",
      },
      overdue_amount: {
        type: ["number", "null"],
        description: "Any overdue, unpaid or arrears amount carried forward from earlier bills, in dollars (not this bill's new charges). Null if none is shown.",
      },
      payment_plan: {
        type: "boolean",
        description: "True if the bill mentions a payment plan, payment arrangement, hardship program, payment assistance, Centrepay deductions or tailored assistance. False otherwise.",
      },
      concession_applied: {
        type: "boolean",
        description:
          "True if the bill shows a government concession for card holders (e.g. 'Annual Electricity Concession', 'Victorian Government concession', 'pensioner concession'). Do not count one-off rebates or bill relief credits. False otherwise.",
      },
      new_charges_total: {
        type: ["number", "null"],
        description:
          "This billing period's new charges including GST, in AUD, before any balance carried forward, payments received or overdue amounts are added (often 'New charges', 'Total new charges', 'This bill'). Discounts, concessions and credits for this period are already taken off. Null if the bill doesn't show it separately.",
      },
      fees: {
        type: "array",
        description: "Any fees charged on this bill, apart from the supply and usage charges: late-payment fees, paper-bill fees, card or payment-processing fees, disconnection or reconnection fees, and other one-off fees. Empty if none.",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["late_payment", "paper_bill", "payment_processing", "reconnection", "other"] },
            amount_dollars: { type: "number", description: "The fee in dollars including GST." },
          },
          required: ["kind", "amount_dollars"],
        },
      },
      discount_not_applied: {
        type: "boolean",
        description: "True if the bill says a pay-on-time, direct-debit or other conditional discount was NOT applied or was lost this period (for example 'You missed your pay-on-time discount'). False otherwise.",
      },
      best_offer_plan: {
        type: ["string", "null"],
        description: "If the bill has the retailer's 'best offer', 'better offer' or 'could you save' message, the plan name it recommends. Null if there's no such message or no plan is named.",
      },
      best_offer_saving: {
        type: ["number", "null"],
        description: "The saving in dollars per year stated in that best offer message. Null if none is stated.",
      },
      best_offer_says_on_best: {
        type: "boolean",
        description: "True if the bill's best offer message says the customer is already on the retailer's best (or cheapest) offer. False otherwise.",
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
      solar_credit_total: { type: ["number", "null"], description: "The dollar credit for solar exported this period, as a positive number (e.g. a 'Solar feed-in credit -$0.07' line is 0.07). Null if not shown." },
      solar_fit_cents: { type: ["number", "null"], description: "Solar feed-in tariff in cents per kWh, as a positive number even if the bill prints it as a credit (e.g. '-0.040 c/kWh' is 0.04). Read it from the solar/feed-in line's rate column; if only the credit and kWh are shown, divide the credit by the kWh. Null if not shown." },
      looks_partial: {
        type: "boolean",
        description:
          "True if this looks like only part of a longer bill: for example it shows 'Page 1 of 2', or shows the account summary and amount due but not the usage and charges details. False if the usage and charges details are shown.",
      },
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

/** Read one PDF, or up to 3 photos of the same bill's pages. */
export async function readBill(files: BillFile[]): Promise<ReadResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "nokey" };
  const isPdf = files.some((f) => f.mediaType === "application/pdf");
  // Claude reads a PDF as a "document" content block (it handles the pages
  // itself — no server-side rasterizing needed) and each photo as an "image"
  // block, all in one request.
  const contentBlocks = files.map((file) =>
    file.mediaType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: file.base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: file.mediaType === "image/jpg" ? "image/jpeg" : file.mediaType, data: file.base64 } },
  );
  const what = isPdf ? "a PDF" : files.length > 1 ? `${files.length} photos of the pages` : "a photo";
  let res: Response;
  try {
    res = await fetch(`${process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "extract_bill_fields" },
        messages: [{
          role: "user",
          content: [
            ...contentBlocks,
            {
              type: "text",
              text:
                  `This is ${what} of an Australian residential energy bill (electricity, gas or both). ` +
                  (files.length > 1 ? "The photos are pages of the same bill: read them together as one bill. " : "") +
                  "Read it " +
                  "carefully and call extract_bill_fields with your best-effort reading. Leave a field null " +
                  "rather than guessing if it isn't clearly shown, and note anything uncertain in warnings. " +
                  "Victorian distributor names can appear with extra wording (e.g. 'CitiPower', 'Jemena " +
                  "Electricity Networks') — map them to the closest of the five listed options, or null if it's " +
                  "clearly a different network. Also read the account holder's name and the supply address " +
                  "(street/suburb/postcode) if printed, and check for any solar feed-in/export credit line — " +
                  "set has_solar true whenever one appears, even if the credit is $0 or very small. If the bill includes gas, fill the gas_* fields " +
                  "(usage in MJ, days, gas charges, gas network) and set fuel accordingly. Also say whether it's a residential or business " +
                  "account, whether it comes from an embedded network (building or strata-supplied power), and whether it has a demand charge. " +
                  "Finally, check whether readings were actual or estimated, any overdue amount or payment plan, whether a government concession " +
                  "is applied, and read the retailer's best offer message (the plan it names and the yearly saving, or that you're already on the best offer).",
            },
          ],
        }],
      }),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text().catch(() => ""));
    return { ok: false, reason: "api" };
  }
  const data = await res.json();
  const content: Array<{ type?: string; input?: unknown }> = Array.isArray(data?.content) ? data.content : [];
  const toolUse = content.find((block) => block?.type === "tool_use");
  if (!toolUse?.input) return { ok: false, reason: "unreadable" };
  const extracted = { ...sanitizeExtractedBill(toolUse.input), pages: isPdf ? 1 : files.length };
  if (!extracted.isElectricityBill && extracted.fuel !== "gas") return { ok: false, reason: "notbill" };
  return { ok: true, extracted };
}
