"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import styles from "./Comparator.module.css";
import snap from "./snap.module.css";

const MAX_DIMENSION = 1600;
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
}: {
  onApply: (bill: ExtractedBill) => void;
  /** "hero": the big, main way into the check. "card": the smaller reminder elsewhere. */
  variant?: "hero" | "card";
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

  async function handleFile(file: File) {
    setStatus("reading");
    setReadingStep(0);
    setErrorMsg("");

    try {
      // PDFs go to the server as-is (the browser's canvas-based resize only
      // works on images) — they're sent to Claude as a document, not an
      // image, so there's no size benefit to resizing anyway.
      const isPdf = file.type === "application/pdf";
      const toSend = isPdf ? file : await resizeImage(file);
      const form = new FormData();
      form.append("photo", toSend, isPdf ? "bill.pdf" : "bill.jpg");

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
      onApply(body.extracted as ExtractedBill);
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong reading that file — please try again, or enter your details manually below.");
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (file) handleFile(file);
  }

  const inputs = (
    <>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className={styles.photoInputHidden} onChange={onInputChange} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className={styles.photoInputHidden} onChange={onInputChange} />
    </>
  );

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
              <span className={snap.billTotal}>$425.31</span>
            </div>
            <span className={snap.scan} />
          </div>
        </div>
        <div className={snap.body}>
          <span className={snap.kicker}>Fastest way · about 30 seconds</span>
          <h2 className={snap.title}>Snap your bill. We&apos;ll do the rest.</h2>
          <ul className={snap.points}>
            <li>We read your usage <b>and the rates you actually pay</b></li>
            <li>Paper bill, PDF or a screenshot from your retailer&apos;s app</li>
            <li>You check what we read before we work anything out</li>
          </ul>
          {reading ? (
            <div className={snap.reading} role="status" aria-live="polite">
              <span className={snap.spinner} aria-hidden="true" />
              {READING_STEPS[readingStep]}
            </div>
          ) : (
            <div className={snap.actions}>
              <button type="button" className={snap.primary} onClick={() => cameraInputRef.current?.click()}>
                <span aria-hidden="true">📷</span> Take a photo of my bill
              </button>
              <button type="button" className={snap.secondary} onClick={() => fileInputRef.current?.click()}>
                <span aria-hidden="true">⬆</span> Upload a PDF or screenshot
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
        <span className={styles.photoBolt}>⚡</span> Got your bill handy?
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
          {status === "reading" ? "Reading your bill…" : "📷 Take a photo"}
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
        className={styles.photoInputHidden}
        onChange={onInputChange}
      />

      {status === "error" && <p className={styles.leadErr}>{errorMsg}</p>}
    </div>
  );
}
