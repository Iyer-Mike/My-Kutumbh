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

/** The India date n days before today, as YYYY-MM-DD. */
export function daysAgoLocal(n: number, now: Date = new Date()): string {
  const [y, m, d] = todayLocal(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** A human date label (e.g. "Tuesday, 22 September") in India time. */
export function longDateLocal(now: Date = new Date()): string {
  return now.toLocaleDateString("en-IN", {
    timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long",
  });
}
