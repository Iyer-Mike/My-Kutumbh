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

// Dishes offered on a festival day, by the names they carry in the dish
// catalogue. The Prime Member ticks as many as the family will have, in
// any meal. A festival of the family's own gets the general list.
const GENERAL = [
  "Payasam", "Paal Payasam (Milk Kheer)", "Rava Kesari (Semolina Sweet)", "Gulab Jamun", "Mysore Pak", "Besan Ladoo",
  "Murukku", "Vada (Medu Vada)", "Puri", "Chole", "Vegetable Biryani", "Curd Rice (Thayir Sadam)",
];

export const FESTIVAL_DISHES: Record<string, string[]> = {
  "Dussehra (Vijayadashami)": [
    "Sundal (Spiced Chickpeas)", "Puliyodarai (Tamarind Rice)", "Curd Rice (Thayir Sadam)", "Thengai Sadam (Coconut Rice)",
    "Elumichai Sadam (Lemon Rice)", "Ven Pongal", "Ulundu Vadai (Urad Dal Fritter)", "Payasam", "Paal Payasam (Milk Kheer)", "Kozhukattai",
  ],
  "Diwali (Deepavali)": [
    "Murukku", "Chakli", "Ribbon Pakoda", "Mysore Pak", "Besan Ladoo", "Jalebi", "Gulab Jamun", "Karanji",
    "Gajar Halwa", "Rava Kesari (Semolina Sweet)", "Moong Dal Halwa", "Puri", "Chole", "Vegetable Biryani",
  ],
  "Christmas": ["Plum", "Vegetable Biryani", "Kheer (Rice Pudding)", "Appam with Coconut Milk Stew", "Payasam", "Gulab Jamun"],
  "New Year's Day": ["Payasam", "Vegetable Biryani", "Rava Kesari (Semolina Sweet)", "Gulab Jamun", "Mysore Pak", "Puri", "Chole"],
  "Pongal / Makar Sankranti": [
    "Ven Pongal", "Payasam", "Vada (Medu Vada)", "Ulundu Vadai (Urad Dal Fritter)", "Kootu (Vegetable & Lentil Curry)",
    "Murukku", "Paal Payasam (Milk Kheer)", "Thengai Sadam (Coconut Rice)", "Puliyodarai (Tamarind Rice)",
  ],
  "Holi": ["Thandai", "Dahi Vada", "Puri", "Chole", "Besan Ladoo", "Jalebi", "Pani Puri", "Dhokla", "Karanji"],
  "Tamil New Year (Puthandu)": [
    "Puliyodarai (Tamarind Rice)", "Payasam", "Vada (Medu Vada)", "Kootu (Vegetable & Lentil Curry)",
    "Elumichai Sadam (Lemon Rice)", "Curd Rice (Thayir Sadam)", "Mysore Pak",
  ],
};

export function festivalDishNames(name: string | null): string[] {
  return (name && FESTIVAL_DISHES[name]) || GENERAL;
}

/** "Dussehra (Vijayadashami)" → "Dussehra"; "Pongal / Makar Sankranti" → "Pongal" */
export function shortFestivalName(name: string): string {
  return name.replace(/\s*\(.*\)/, "").split(" / ")[0].trim();
}
