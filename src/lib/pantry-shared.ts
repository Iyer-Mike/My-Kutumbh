// Small pieces both the server and the phone need, kept apart from anything that sends alerts.

export const ITEM_COLS =
  "id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note, library_key, stock_at, daily_use";

/** The calendar day of a moment, in the family's own zone. */
export function dayIn(ts: string | null, timeZone: string): string | null {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}
