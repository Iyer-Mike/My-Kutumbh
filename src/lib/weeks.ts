// Calendar weeks as an Indian wall calendar prints them: Sunday to Saturday,
// and the week holding 1 January is Week 1. Dates are plain YYYY-MM-DD.

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (date: string, n: number) => iso(utc(date) + n * DAY);
export const dayOfWeek = (date: string) => new Date(utc(date)).getUTCDay();   // 0 = Sunday

/** Sunday–Saturday week holding `date`, numbered by its Saturday's year. */
export function weekOf(date: string): { n: number; start: string; end: string } {
  const start = addDays(date, -dayOfWeek(date));
  const end = addDays(start, 6);
  const y = Number(end.slice(0, 4));
  const jan1 = `${y}-01-01`;
  const doy = Math.round((utc(end) - utc(jan1)) / DAY) + 1;
  return { n: Math.floor((doy - 1 + dayOfWeek(jan1)) / 7) + 1, start, end };
}

/** The first of the month holding `date`. */
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
