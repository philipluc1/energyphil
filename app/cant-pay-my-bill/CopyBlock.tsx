"use client";

import { useState } from "react";
import c from "./cantpay.module.css";

/** The message, shown as text with a Copy button. Nothing is sent or saved. */
export default function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={c.copy}>
      <pre>{text}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
        }}
      >
        {copied ? "Copied" : "Copy the message"}
      </button>
    </div>
  );
}
