"use client";

import Icon from "./Icon";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import styles from "./Comparator.module.css";
import snap from "./snap.module.css";

const MAX_DIMENSION = 1600;
/** Photos of one bill read together (page 1, page 2…); matches the server. */
export const MAX_BILL_PAGES = 3;
const JPEG_QUALITY = 0.85;

// Phones can hand us 4000px, multi-megabyte photos. Resizing in the browser
// before upload keeps the request small/fast and keeps the API cost per scan
// down — the model doesn't read numbers any better from a bigger image past
// this point.
async function resizeImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    return blob ?? file;
  } catch {
    return file;
  }
}

type Status = "idle" | "reading" | "error";
type Access = "checking" | "member" | "locked";

// Shown one after another while the bill is being read (it takes a few
// seconds), so the wait feels like progress rather than a frozen button.
const READING_STEPS = ["Finding your usage…", "Reading the rates you pay…", "Working out your network…", "Almost there…"];

export default function BillPhotoUpload({
  onApply,
  variant = "card",
  fuel = "electricity",
  priorPages = [],
}: {
  /** The read, and the photos it came from (none for a PDF), so a page can be added later. */
  onApply: (bill: ExtractedBill, pages: Blob[]) => void;
  /** "hero": the big, main way into the check. "card": the smaller reminder elsewhere.
   *  "addPage": one more page of a bill already read; re-reads all pages together. */
  variant?: "hero" | "strip" | "card" | "addPage";
  /** Gas wording for the big panel and the strip; electricity by default. */
  fuel?: "electricity" | "gas";
  /** Pages already read (photos), sent again with the new one so the bill is read as a whole. */
  priorPages?: Blob[];
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [access, setAccess] = useState<Access>("checking");
  const [readingStep, setReadingStep] = useState(0);

  useEffect(() => {
    if (status !== "reading") return;
    const t = setInterval(() => setReadingStep((n) => Math.min(n + 1, READING_STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, [status]);

  // UI hint only — the server re-checks membership on every upload.
  useEffect(() => {
    if (!supabase) {
      Promise.resolve().then(() => setAccess("locked"));
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const email = data.session?.user?.email;
      if (!email) return !cancelled && setAccess("locked");
      const res = await fetch("/api/member-status", {
        headers: { authorization: `Bearer ${data.session?.access_token}` },
      }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (!cancelled) setAccess(body?.member ? "member" : "locked");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFiles(list: File[]) {
    setStatus("reading");
    setReadingStep(0);
    setErrorMsg("");

    try {
      // PDFs go to the server as-is (the browser's canvas-based resize only
      // works on images) — they're sent to Claude as a document, not an
      // image, so there's no size benefit to resizing anyway. Photos are
      // pages: any already read go again with the new ones, so the model
      // reads the bill as a whole.
      const pdf = list.find((f) => f.type === "application/pdf");
      let pages: Blob[];
      if (pdf) {
        if (priorPages.length) {
          setStatus("error");
          setErrorMsg("Add the next page as a photo, or upload the whole bill as one PDF from the start.");
          return;
        }
        pages = [pdf];
      } else {
        const fresh = await Promise.all(list.filter((f) => f.type.startsWith("image/")).map(resizeImage));
        pages = [...priorPages, ...fresh].slice(0, MAX_BILL_PAGES);
      }
      if (!pages.length) {
        setStatus("error");
        setErrorMsg("That doesn't look like a photo or PDF.");
        return;
      }
      const form = new FormData();
      pages.forEach((p, i) => form.append("photo", p, pdf ? "bill.pdf" : `page-${i + 1}.jpg`));

      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch("/api/extract-bill", {
        method: "POST",
        body: form,
        headers: session ? { authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const body = await res.json().catch(() => ({ ok: false, message: "Something went wrong reading that file." }));

      if (!body.ok) {
        setStatus("error");
        setErrorMsg(body.message || "Couldn't read that file.");
        return;
      }

      setStatus("idle");
      onApply(body.extracted as ExtractedBill, pdf ? [] : pages);
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong reading that file — please try again, or enter your details manually below.");
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file next time
    if (list.length) handleFiles(list);
  }

  const inputs = (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className={styles.photoInputHidden} onChange={onInputChange} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className={styles.photoInputHidden} onChange={onInputChange} />
    </>
  );

  if (variant === "addPage") {
    const reading = status === "reading";
    const next = priorPages.length + 1;
    return (
      <div className={snap.addPage}>
        {reading ? (
          <div className={snap.reading} role="status" aria-live="polite">
            <span className={snap.spinner} aria-hidden="true" />
            Reading {next} pages together…
          </div>
        ) : (
          <div className={snap.addPageActions}>
            <button type="button" className={snap.addPagePrimary} onClick={() => cameraInputRef.current?.click()}>
              <Icon name="camera" size={18} /> Add page {next}
            </button>
            <button type="button" className={snap.addPageSecondary} onClick={() => fileInputRef.current?.click()}>
              Choose a photo
            </button>
          </div>
        )}
        {status === "error" && <p className={snap.err}>{errorMsg}</p>}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className={styles.photoInputHidden} onChange={onInputChange} />
        <input ref={fileInputRef} type="file" accept="image/*" multiple className={styles.photoInputHidden} onChange={onInputChange} />
      </div>
    );
  }

  if (variant === "strip") {
    const reading = status === "reading";
    return (
      <div className={snap.strip}>
        <div className={snap.stripText}>
          <span className={snap.stripIcon} aria-hidden="true"><Icon name="camera" size={24} /></span>
          <span>
            <b>{reading ? READING_STEPS[readingStep] : "Got your bill? Skip these questions."}</b>
            {!reading && <small>{fuel === "gas" ? "A photo fills in your network, the days and the MJ. About 30 seconds." : "A photo fills in everything, including your real rates. About 30 seconds."}</small>}
          </span>
        </div>
        {reading ? (
          <span className={snap.spinner} aria-hidden="true" />
        ) : (
          <div className={snap.stripActions}>
            <button type="button" className={snap.stripPrimary} onClick={() => cameraInputRef.current?.click()}><Icon name="camera" /> Snap my bill</button>
            <button type="button" className={snap.stripSecondary} onClick={() => fileInputRef.current?.click()}>Upload</button>
          </div>
        )}
        {status === "error" && <p className={snap.err}>{errorMsg}</p>}
        {inputs}
      </div>
    );
  }

  if (variant === "hero") {
    const reading = status === "reading";
    return (
      <div className={snap.hero}>
        <div className={snap.art} aria-hidden="true">
          <div className={snap.phone}>
            <div className={snap.bill}>
              <span className={snap.billHead} />
              <span className={snap.billLine} />
              <span className={snap.billLine} />
              <span className={`${snap.billLine} ${snap.billShort}`} />
              <span className={snap.billTotal}>{fuel === "gas" ? "$245.60" : "$425.31"}</span>
            </div>
            <span className={snap.scan} />
          </div>
        </div>
        <div className={snap.body}>
          <span className={snap.kicker}>Takes about 30 seconds</span>
          <h1 className={snap.title}>{fuel === "gas" ? "Start with a photo of your gas bill" : "Start with a photo of your bill"}</h1>
          {fuel === "gas" ? (
            <ul className={snap.points}>
              <li>We read your network, the days and the <b>megajoules (MJ) you used</b></li>
              <li>Paper bill, PDF or a screenshot from your retailer&apos;s app</li>
              <li>Gas and electricity on one bill? We read both</li>
            </ul>
          ) : (
            <ul className={snap.points}>
              <li>We read your usage <b>and the rates you actually pay</b></li>
              <li>Paper bill (both pages if it has two: pick them together), PDF or a screenshot from your retailer&apos;s app</li>
              <li>You check what we read, and can change it, before we work anything out</li>
            </ul>
          )}
          {reading ? (
            <div className={snap.reading} role="status" aria-live="polite">
              <span className={snap.spinner} aria-hidden="true" />
              {READING_STEPS[readingStep]}
            </div>
          ) : (
            <div className={snap.actions}>
              <button type="button" className={snap.primary} onClick={() => cameraInputRef.current?.click()}>
                <Icon name="camera" size={20} /> Take a photo of my bill
              </button>
              <button type="button" className={snap.secondary} onClick={() => fileInputRef.current?.click()}>
                <Icon name="upload" size={18} /> Upload a PDF or screenshot
              </button>
            </div>
          )}
          {status === "error" && <p className={snap.err}>{errorMsg}</p>}
          <p className={snap.fine}>
            Free, no sign-up.{access === "member" ? "" : " Your first reads are free."} We only keep the numbers, not the picture.
          </p>
        </div>
        {inputs}
      </div>
    );
  }

  if (access === "checking") return null;
  return (
    <div className={styles.photoCard}>
      <div className={styles.stepLabel}>
        <Icon name="camera" /> Got your bill handy?
      </div>
      <p className={styles.helper}>
        Snap a photo, upload the PDF, or screenshot your plan in your retailer&apos;s app. We read your usage <b>and the rates you actually pay</b>, so the answer is exact. You can check everything before we calculate.
        {access === "member" ? "" : " Your first reads are free; members can read a bill any time and keep every month's result."}
      </p>

      <div className={styles.photoActions}>
        <button
          type="button"
          className={styles.photoBtn}
          onClick={() => cameraInputRef.current?.click()}
          disabled={status === "reading"}
        >
          {status === "reading" ? "Reading your bill…" : "Take a photo"}
        </button>
        <button
          type="button"
          className={`${styles.photoBtn} ${styles.photoBtnSecondary}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "reading"}
        >
          Upload bill, PDF or screenshot
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.photoInputHidden}
        onChange={onInputChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className={styles.photoInputHidden}
        onChange={onInputChange}
      />

      {status === "error" && <p className={styles.leadErr}>{errorMsg}</p>}
    </div>
  );
}
