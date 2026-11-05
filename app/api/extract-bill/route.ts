import { NextRequest, NextResponse } from "next/server";
import { readBill } from "@/lib/billReader";
import { requireActiveMember } from "@/lib/memberAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FREE_DEVICE_DAYS, FREE_EMAIL_DAYS, afterRead, beforeRead, nextFreeDate, type PriorRead, type ReadFuel } from "@/lib/freeReads";

// Each read costs us an AI call. Members get 10 a day; everyone else gets a
// couple a day per connection, enough to try it for real before joining.
const MAX_READS_PER_DAY = 10;
// 3 so a visitor can add page 2 of a paper bill (a second read) and still retry once.
// Per connection: households on a shared mobile or office network share one, so not too tight.
const FREE_READS_PER_DAY = 5;
/** Photos of one bill read together (page 1, page 2…). A PDF is always one file. */
const MAX_PAGES = 3;
// Total free (visitor) reads per day across the whole site. Raise it as traffic grows.
const FREE_READS_ALL_VISITORS_PER_DAY = Number(process.env.FREE_READS_PER_DAY_TOTAL ?? 300);

// Vision calls can take a few seconds; give it more room than the default.
export const maxDuration = 30;

// The browser resizes photos to ~1600px before upload (see BillPhotoUpload.tsx),
// so a real submission should be well under this — this just guards against a
// stray huge file wasting an API call. PDFs aren't resized client-side, so the
// cap is a bit higher to allow for a multi-page scanned bill.
const MAX_BYTES = 15 * 1024 * 1024;



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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Couldn't read that upload — please try again." }, { status: 400 });
  }
  // Visitors: a random ID from their browser, and the email they gave for more free reads (if any).
  const rawDevice = String(form.get("device") ?? "");
  const device = !member.ok && /^[A-Za-z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : null;
  const rawEmail = String(form.get("email") ?? "").trim().toLowerCase();
  const leadEmail = !member.ok && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) && rawEmail.length <= 200 ? rawEmail : null;

  // Record first, then count (this read included), so a burst of parallel
  // uploads can't all slip under the limit. A read that never reaches the
  // bill reader (a bad file, a network error) is taken back off the count.
  // The allowance columns (device, lead_email, fuel) may not exist yet: then
  // only the daily limit applies.
  let allowance = !member.ok && !!device;
  const first = await supabaseAdmin
    .from("bill_reads")
    .insert(allowance ? { email: key, device, lead_email: leadEmail } : { email: key })
    .select("id")
    .single();
  let readRow = first.data;
  const readErr = first.error;
  if (readErr && allowance) {
    console.warn("extract-bill: free-read allowance off (run supabase/schema.sql)", readErr.message);
    allowance = false;
    ({ data: readRow } = await supabaseAdmin.from("bill_reads").insert({ email: key }).select("id").single());
  }
  const readId = (readRow as { id?: string } | null)?.id ?? null;
  const unCount = async () => { if (readId) await supabaseAdmin!.from("bill_reads").delete().eq("id", readId); };
  const { count } = await supabaseAdmin
    .from("bill_reads")
    .select("id", { count: "exact", head: true })
    .eq("email", key)
    .gte("created_at", since);
  if ((count ?? 0) > cap) {
    await unCount();
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
      await unCount();
      return NextResponse.json({ ok: false, message: "Free photo reading is busy today. Type the numbers in below, or try tomorrow." }, { status: 429 });
    }
  }

  // The free allowance, before spending an AI call.
  let priors: PriorRead[] = [];
  let sameSession = false;
  if (allowance && readId) {
    const sinceFor = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    const q = supabaseAdmin.from("bill_reads").select("fuel, created_at").neq("id", readId).in("fuel", ["electricity", "gas", "dual"]);
    const { data: rows } = await (leadEmail ? q.eq("lead_email", leadEmail).gte("created_at", sinceFor(FREE_EMAIL_DAYS)) : q.eq("device", device!).gte("created_at", sinceFor(FREE_DEVICE_DAYS)));
    priors = (rows ?? []) as PriorRead[];
    const { data: devRows } = await supabaseAdmin.from("bill_reads").select("fuel, created_at").neq("id", readId).eq("device", device!).in("fuel", ["electricity", "gas", "dual"]).gte("created_at", sinceFor(FREE_EMAIL_DAYS));
    const pre = beforeRead({ priors, deviceReads: (devRows ?? []) as PriorRead[], hasEmail: !!leadEmail });
    sameSession = pre.sameSession;
    if (pre.block) {
      await unCount();
      return NextResponse.json(pre.block === "quota" ? quotaReply(priors) : needEmailReply(), { status: 429 });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    await unCount();
    return NextResponse.json(
      { ok: false, message: "Photo reading isn't switched on yet — enter your details manually below." },
      { status: 200 },
    );
  }

  // One PDF, or up to MAX_PAGES photos of the same bill (page 1, page 2…).
  const files = form.getAll("photo").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    await unCount();
    return NextResponse.json({ ok: false, message: "No file received." }, { status: 400 });
  }
  const isPdf = files.some((f) => f.type === "application/pdf");
  if (isPdf && files.length > 1) {
    await unCount();
    return NextResponse.json({ ok: false, message: "Send one PDF on its own, or up to 3 photos of the bill's pages." }, { status: 400 });
  }
  if (files.length > MAX_PAGES) {
    await unCount();
    return NextResponse.json({ ok: false, message: `Up to ${MAX_PAGES} pages at a time. The usage and charges pages matter most.` }, { status: 400 });
  }
  if (files.some((f) => f.type !== "application/pdf" && !f.type.startsWith("image/"))) {
    await unCount();
    return NextResponse.json({ ok: false, message: "That doesn't look like an image or PDF file." }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_BYTES) || files.reduce((n, f) => n + f.size, 0) > MAX_BYTES * 2) {
    await unCount();
    return NextResponse.json(
      { ok: false, message: "That file's too large — try a smaller photo, or a shorter PDF." },
      { status: 400 },
    );
  }

  const read = await readBill(await Promise.all(files.map(async (file) => ({ mediaType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") }))));
  if (!read.ok) {
    if (read.reason === "unreachable") {
      await unCount();
      return NextResponse.json({ ok: false, message: "Couldn't reach the bill reader — please try again shortly." }, { status: 502 });
    }
    if (read.reason === "api" || read.reason === "nokey") {
      await unCount();
      return NextResponse.json({ ok: false, message: "The bill reader had a problem — please try again, or enter your details manually." }, { status: 502 });
    }
    if (read.reason === "unreadable") {
      return NextResponse.json(
        { ok: false, message: `Couldn't make sense of that ${isPdf ? "PDF" : files.length > 1 ? "bill" : "photo"} — please try a clearer one or enter details manually.` },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: false, message: "That doesn't look like an energy bill — try another file, or enter your details manually below." }, { status: 200 });
  }
  const extracted = read.extracted;

  if (allowance && readId) {
    const fuel: ReadFuel = extracted.fuel === "gas" || extracted.fuel === "dual" ? extracted.fuel : "electricity";
    // Every fuel on this bill already had its free read: not this time.
    const post = afterRead({ priors, fuel, sameSession, hasEmail: !!leadEmail });
    if (post) {
      await unCount();
      return NextResponse.json(post === "quota" ? quotaReply(priors, fuel) : needEmailReply(fuel), { status: 429 });
    }
    // A page or retry in the same sitting isn't counted again.
    await supabaseAdmin.from("bill_reads").update({ fuel: sameSession ? "retry" : fuel }).eq("id", readId);
  }

  return NextResponse.json({ ok: true, extracted });
}

const fuelWord = (f?: ReadFuel) => (f === "gas" ? "gas" : f === "dual" ? "electricity and gas" : "electricity");

/** No email yet and the device's free photo is used: ask for an email to unlock the next one. */
function needEmailReply(fuel?: ReadFuel) {
  return {
    ok: false,
    needEmail: true,
    message: `Your free ${fuel ? fuelWord(fuel) + " " : ""}photo is used on this device. Add your email for another free read this quarter, or type the numbers in.`,
  };
}

/** This email has had its free read(s) this quarter. */
function quotaReply(priors: PriorRead[], fuel?: ReadFuel) {
  const next = nextFreeDate(priors, fuel);
  const when = next ? next.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" }) : null;
  return {
    ok: false,
    quota: true,
    message: `You've used your free ${fuel ? fuelWord(fuel) + " " : ""}photo for this quarter${when ? ` (the next one is free from ${when})` : ""}. Type the numbers in for free, or join Utilo Plus for unlimited photos.`,
  };
}
