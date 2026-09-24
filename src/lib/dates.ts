// Every "today" in the app is the family's calendar day, not UTC.
// toISOString() gives the UTC date, which in India rolls over at 5:30 AM —
// so a snack at 12:30 AM would land on yesterday. A Kutumbh in New Jersey
// has the same problem the other way, so the family's own zone decides.
// Works the same on the server (Vercel runs in UTC) and in any browser.
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/** @deprecated The family's zone travels with the page; this is only the fallback. */
export const APP_TIME_ZONE = DEFAULT_TIME_ZONE;

// Intl formatters are slow to build and often reused, so keep them
const formatters = new Map<string, Intl.DateTimeFormat>();
function ymd(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      // An unknown zone must never break the day
      f = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
    }
    formatters.set(tz, f);
  }
  return f;
}

/** Today where the family lives, as YYYY-MM-DD. */
export function todayLocal(tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return ymd(tz).format(now);
}

/** The family's date n days ahead of today. */
export function daysAheadLocal(n: number, tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return daysAgoLocal(-n, tz, now);
}

/** The family's date n days before today. */
export function daysAgoLocal(n: number, tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  const [y, m, d] = todayLocal(tz, now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** Whole days from today to this date: -1 is yesterday, +1 tomorrow. */
export function daysFromToday(date: string, tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): number {
  const a = new Date(`${todayLocal(tz, now)}T00:00:00Z`).getTime();
  const b = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * A date from the address bar, kept inside what the page allows:
 * how many days back, and how many forward.
 */
export function clampDay(
  raw: string | null | undefined, back: number, ahead: number,
  tz: string = DEFAULT_TIME_ZONE, now: Date = new Date(),
): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayLocal(tz, now);
  const off = daysFromToday(raw, tz, now);
  if (Number.isNaN(off)) return todayLocal(tz, now);
  if (off < -back) return daysAgoLocal(back, tz, now);
  if (off > ahead) return daysAheadLocal(ahead, tz, now);
  return raw;
}

/** "Today", "Yesterday", "Tomorrow", or "Tue, 24 Sep". */
export function dayLabel(date: string, tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  const off = daysFromToday(date, tz, now);
  if (off === 0) return "Today";
  if (off === -1) return "Yesterday";
  if (off === 1) return "Tomorrow";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  });
}

/**
 * "Tomorrow" or "Yesterday" when the day is one either side of today, and
 * nothing otherwise — for a line that already carries the full date and
 * should not say it twice.
 */
export function nearbyDay(date: string, tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string | null {
  const off = daysFromToday(date, tz, now);
  return off === 1 ? "Tomorrow" : off === -1 ? "Yesterday" : null;
}

/** The full date of a given day, e.g. "Tuesday, 24 September". */
export function longDateFor(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
}

/** Today, written out in full, where the family lives. */
export function longDateLocal(tz: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return longDateFor(todayLocal(tz, now));
}

/** The zones a family is likely to live in, for the Prime Member to pick from. */
export const TIME_ZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata",        label: "India (IST)" },
  { value: "Asia/Dubai",          label: "UAE · Gulf" },
  { value: "Asia/Singapore",      label: "Singapore · Malaysia" },
  { value: "Asia/Tokyo",          label: "Japan" },
  { value: "Australia/Sydney",    label: "Australia (east)" },
  { value: "Australia/Perth",     label: "Australia (west)" },
  { value: "Pacific/Auckland",    label: "New Zealand" },
  { value: "Europe/London",       label: "United Kingdom" },
  { value: "Europe/Paris",        label: "Europe (central)" },
  { value: "Africa/Nairobi",      label: "East Africa" },
  { value: "Africa/Lagos",        label: "West Africa" },
  { value: "America/New_York",    label: "USA · Canada (eastern)" },
  { value: "America/Chicago",     label: "USA · Canada (central)" },
  { value: "America/Denver",      label: "USA (mountain)" },
  { value: "America/Los_Angeles", label: "USA · Canada (pacific)" },
  { value: "America/Toronto",     label: "Canada (Toronto)" },
  { value: "America/Sao_Paulo",   label: "Brazil" },
  { value: "UTC",                 label: "UTC" },
];

export function timeZoneLabel(tz: string): string {
  return TIME_ZONES.find((z) => z.value === tz)?.label ?? tz;
}

/** What the phone says it is, when it is one we offer. */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIME_ZONES.some((z) => z.value === tz) ? tz : null;
  } catch {
    return null;
  }
}
