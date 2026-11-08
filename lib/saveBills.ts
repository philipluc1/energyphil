import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import type { BillRow } from "./billRows";

/**
 * Saves bill rows to the tracker (8 Nov 2026). If the database doesn't have
 * bills.detail yet (schema.sql not re-run), saves the rest rather than
 * nothing, and says so loudly in the logs.
 */
export async function saveBillRows(rows: BillRow[], where: string): Promise<{ error: string | null }> {
  if (!supabaseAdmin || !rows.length) return { error: null };
  let { error } = await supabaseAdmin.from("bills").upsert(rows, { onConflict: "email,fuel,period_end" });
  if (error && /detail/.test(error.message)) {
    console.error(`${where}: bills.detail is missing, the bill breakdown was dropped. Run supabase/schema.sql.`);
    ({ error } = await supabaseAdmin.from("bills").upsert(rows.map(({ detail: _d, ...r }) => r), { onConflict: "email,fuel,period_end" }));
  }
  if (error) console.warn(`${where}: bill tracker not saved (run supabase/schema.sql)`, error.message);
  return { error: error?.message ?? null };
}
