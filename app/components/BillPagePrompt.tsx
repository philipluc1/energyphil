"use client";

import type { ReactNode } from "react";
import type { ExtractedBill } from "@/lib/billExtraction";
import { billGaps, listWords, shouldAskForAnotherPage } from "@/lib/billExtraction";
import BillPhotoUpload, { MAX_BILL_PAGES } from "./BillPhotoUpload";
import snap from "./snap.module.css";

/**
 * After a bill read that's missing something (usually because the photo was
 * the first page, and the usage, billing period and rates are on page 2):
 * says what's missing and offers to add the next page, which is read
 * together with the earlier ones. Renders nothing when the read is complete.
 */
export default function BillPagePrompt({
  bill,
  pages,
  onApply,
  typeItIn,
}: {
  bill: ExtractedBill | null;
  /** The photos the read came from (empty for a PDF). */
  pages: Blob[];
  onApply: (bill: ExtractedBill, pages: Blob[]) => void;
  /** Where to fix it by hand, e.g. "Or type them in below." */
  typeItIn: ReactNode;
}) {
  if (!bill || !shouldAskForAnotherPage(bill)) return null;
  const gaps = billGaps(bill);
  const needed = gaps.filter((g) => g.needed);
  const shown = (needed.length ? needed : gaps.filter((g) => g.key === "total" || g.key === "rates")).map((g) => g.label);
  const canAdd = pages.length > 0 && pages.length < MAX_BILL_PAGES;
  const photoRead = pages.length > 0;
  return (
    <div className={snap.pagePrompt} role="status">
      <b>
        {photoRead && pages.length === 1
          ? "Looks like we only got page 1"
          : photoRead
            ? `We read ${pages.length} pages, but something's still missing`
            : "Something's missing from that bill"}
      </b>
      <p>
        We couldn&apos;t find {listWords(shown)}.
        {canAdd ? ` On most bills ${shown.length > 1 ? "they're" : "it's"} on page 2, with the usage and charges. Add that page and we'll read them together.` : ""}
        {needed.length === 0 ? " We can still compare plans without it." : ""}
      </p>
      {canAdd && <BillPhotoUpload variant="addPage" priorPages={pages} onApply={onApply} />}
      <p className={snap.pagePromptAlt}>{typeItIn}</p>
    </div>
  );
}
