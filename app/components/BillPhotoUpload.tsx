"use client";

import { useRef, useState, type ChangeEvent } from "react";
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

export default function BillPhotoUpload({ onApply }: { onApply: (bill: ExtractedBill) => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFile(file: File) {
    setStatus("reading");
    setErrorMsg("");

    try {
      const resized = await resizeImage(file);
      const form = new FormData();
      form.append("photo", resized, "bill.jpg");

      const res = await fetch("/api/extract-bill", { method: "POST", body: form });
      const body = await res.json().catch(() => ({ ok: false, message: "Something went wrong reading that photo." }));

      if (!body.ok) {
        setStatus("error");
        setErrorMsg(body.message || "Couldn't read that photo.");
        return;
      }

      setStatus("idle");
      onApply(body.extracted as ExtractedBill);
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong reading that photo — please try again, or enter your details manually below.");
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (file) handleFile(file);
  }

  return (
    <div className={styles.photoCard}>
      <div className={styles.stepLabel}>
        <span className={styles.photoBolt}>⚡</span> Got your bill handy?
      </div>
      <p className={styles.helper}>
        Snap a photo or upload one and we&apos;ll read the numbers off it for you — you&apos;ll still get to check
        everything below before we calculate anything.
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
          Upload a photo
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
      <input ref={fileInputRef} type="file" accept="image/*" className={styles.photoInputHidden} onChange={onInputChange} />

      {status === "error" && <p className={styles.leadErr}>{errorMsg}</p>}
    </div>
  );
}
