import { NextRequest, NextResponse } from "next/server";
import { sanitizeExtractedBill } from "@/lib/billExtraction";

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
  description: "Extract structured billing data from a photo of an Australian residential electricity bill.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_electricity_bill: {
        type: "boolean",
        description:
          "True only if the image clearly shows a residential electricity bill (not a gas bill, receipt, or unrelated photo).",
      },
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
                  `This is a ${isPdf ? "PDF" : "photo"} of an Australian residential electricity bill. Read it ` +
                  "carefully and call extract_bill_fields with your best-effort reading. Leave a field null " +
                  "rather than guessing if it isn't clearly shown, and note anything uncertain in warnings. " +
                  "Victorian distributor names can appear with extra wording (e.g. 'CitiPower', 'Jemena " +
                  "Electricity Networks') — map them to the closest of the five listed options, or null if it's " +
                  "clearly a different network.",
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

  if (!extracted.isElectricityBill) {
    return NextResponse.json(
      {
        ok: false,
        message: "That doesn't look like an electricity bill — try another file, or enter your details manually below.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, extracted });
}
