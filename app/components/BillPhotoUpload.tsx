"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBill } from "@/lib/billExtraction";
import styles from "./Comparator.module.css";

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

export default function BillPhotoUpload({ onApply }: { onApply: (bill: ExtractedBill) => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [access, setAccess] = useState<Access>("checking");

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
