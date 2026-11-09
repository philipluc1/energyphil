import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which columns and tables from supabase/schema.sql the live database is
 * missing (7 Nov 2026). The app tolerates a missing column by dropping that
 * field on save, which is how a member's gas rates and retailer went missing
 * without anyone noticing. The owner dashboard shows this; nothing else uses it.
 */
export interface SchemaHealth { missingColumns: string[]; missingTables: string[] }

/** The newer subscriber columns, oldest first, so the list reads like a to-do. */
export const RECENT_SUBSCRIBER_COLUMNS = [
  "demand_kw", "gas_current_retailer", "gas_rates", "bill_inbox", "inbox_last_at", "inbox_last_status", "inbox_pending", "inbox_gmail_code",
  "switch_remind_on", "switch_remind_note", "money_found", "review_asks", "review_clicked_at", "monthly_summary", "alert_min_saving", "concession_card", "first_check_emailed_at",
];
/** 9 Nov 2026: newer columns on other tables ("table.column"). bill_inbox used to sit in the
 *  tables list by mistake (it's a subscribers column), so the dashboard always said it was missing. */
export const RECENT_OTHER_COLUMNS = ["bills.detail", "live_sessions.active_seconds"];
export const RECENT_TABLES = ["bill_reads", "ad_spend", "check_events", "page_views", "live_sessions", "review_clicks"];

/** The column a PostgREST error names, in any of its three phrasings. */
export function columnFromError(message: string): string | null {
  const m = /could not find the '([a-z0-9_]+)' column/i.exec(message)
    ?? /column "([a-z0-9_]+)" of relation/i.exec(message)
    ?? /column [a-z0-9_]+\.([a-z0-9_]+) does not exist/i.exec(message);
  return m ? m[1] : null;
}

export async function schemaHealth(db: SupabaseClient): Promise<SchemaHealth> {
  const missingColumns: string[] = [];
  let cols = [...RECENT_SUBSCRIBER_COLUMNS];
  // Select them all; each error names one missing column, so drop it and ask again.
  for (let i = 0; i < RECENT_SUBSCRIBER_COLUMNS.length && cols.length; i++) {
    const { error } = await db.from("subscribers").select(cols.join(", ")).limit(1);
    if (!error) break;
    const c = columnFromError(error.message);
    if (!c || !cols.includes(c)) break;
    missingColumns.push(c);
    cols = cols.filter((x) => x !== c);
  }
  for (const tc of RECENT_OTHER_COLUMNS) {
    const [t, c] = tc.split(".");
    const { error } = await db.from(t).select(c).limit(1);
    if (error && columnFromError(error.message) === c) missingColumns.push(tc);
  }
  const missingTables: string[] = [];
  for (const t of RECENT_TABLES) {
    const { error } = await db.from(t).select("*").limit(1);
    if (error && /does not exist|schema cache|not find the table/i.test(error.message)) missingTables.push(t);
  }
  return { missingColumns, missingTables };
}
