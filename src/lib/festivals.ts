// Festival days that come with the app. Dates for lunar festivals differ by
// region and by panchang, so the Prime Member can add a family's own, and
// the page says to check these against the family's calendar.
export type Festival = { name: string; date: string };

export const BUILT_IN_FESTIVALS: Festival[] = [
  { name: "Dussehra (Vijayadashami)",     date: "2026-10-20" },
  { name: "Diwali (Deepavali)",           date: "2026-11-08" },
  { name: "Christmas",                    date: "2026-12-25" },
  { name: "New Year's Day",               date: "2027-01-01" },
  { name: "Pongal / Makar Sankranti",     date: "2027-01-14" },
  { name: "Holi",                         date: "2027-03-22" },
  { name: "Tamil New Year (Puthandu)",    date: "2027-04-14" },
];
