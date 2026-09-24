// Every "today" in the app is the family's calendar day in India, not UTC.
// toISOString() gives the UTC date, which in India rolls over at 5:30 AM —
// so a snack at 12:30 AM would land on yesterday. Works the same on the
// server (Vercel runs in UTC) and in any browser.
export const APP_TIME_ZONE = "Asia/Kolkata";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Today's date in India as YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  return ymd.format(now);
}

/** The India date n days ahead of today, as YYYY-MM-DD. */
export function daysAheadLocal(n: number, now: Date = new Date()): string {
  return daysAgoLocal(-n, now);
}

/** The India date n days before today, as YYYY-MM-DD. */
export function daysAgoLocal(n: number, now: Date = new Date()): string {
  const [y, m, d] = todayLocal(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** Whole days from today to this date: -1 is yesterday, +1 tomorrow. */
export function daysFromToday(date: string, now: Date = new Date()): number {
  const a = new Date(`${todayLocal(now)}T00:00:00Z`).getTime();
  const b = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * A date from the address bar, kept inside what the page allows:
 * how many days back, and how many forward.
 */
export function clampDay(raw: string | null | undefined, back: number, ahead: number, now: Date = new Date()): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayLocal(now);
  const off = daysFromToday(raw, now);
  if (Number.isNaN(off)) return todayLocal(now);
  if (off < -back) return daysAgoLocal(back, now);
  if (off > ahead) return daysAheadLocal(ahead, now);
  return raw;
}

/** "Today", "Yesterday", "Tomorrow", or "Tue, 24 Sep". */
export function dayLabel(date: string, now: Date = new Date()): string {
  const off = daysFromToday(date, now);
  if (off === 0) return "Today";
  if (off === -1) return "Yesterday";
  if (off === 1) return "Tomorrow";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  });
}

/** The full date of a given day, e.g. "Tuesday, 24 September". */
export function longDateFor(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
}

/** A human date label (e.g. "Tuesday, 22 September") in India time. */
export function longDateLocal(now: Date = new Date()): string {
  return now.toLocaleDateString("en-IN", {
    timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long",
  });
}
