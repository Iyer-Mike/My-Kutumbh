// Festival days that come with the app. Dates for lunar festivals differ by
// region and by panchang, so the Prime Member can add a family's own, and
// the page says to check these against the family's calendar.
export type Festival = { name: string; date: string };

export const BUILT_IN_FESTIVALS: Festival[] = [
  { name: "Dussehra (Vijayadashami)",     date: "2026-10-20" },
  { name: "Diwali (Deepavali)",           date: "2026-11-08" },
  { name: "Guru Nanak Gurpurab",          date: "2026-11-24" },
  { name: "Christmas",                    date: "2026-12-25" },
  { name: "New Year's Day",               date: "2027-01-01" },
  { name: "Pongal / Makar Sankranti",     date: "2027-01-14" },
  { name: "Eid al-Fitr",                  date: "2027-03-10" },
  { name: "Holi",                         date: "2027-03-22" },
  { name: "Easter",                       date: "2027-03-28" },
  { name: "Tamil New Year (Puthandu)",    date: "2027-04-14" },
  { name: "Baisakhi",                     date: "2027-04-14" },
];

// Vegetarian dishes offered on a festival day, by the names they carry in
// the dish catalogue: what is made for that festival across Indian homes.
// The Prime Member ticks as many as the family will have, in any meal.
// A festival of the family's own gets the general festive list.
const GENERAL = [
  "Payasam", "Paal Payasam (Milk Kheer)", "Kheer (Rice Pudding)", "Rava Kesari (Semolina Sweet)", "Gulab Jamun",
  "Mysore Pak", "Besan Ladoo", "Murukku", "Vada (Medu Vada)", "Puri", "Chole", "Vegetable Pulao", "Curd Rice (Thayir Sadam)",
];

export const FESTIVAL_DISHES: Record<string, string[]> = {
  "Dussehra (Vijayadashami)": [
    "Sundal (Spiced Chickpeas)", "Puliyodarai (Tamarind Rice)", "Curd Rice (Thayir Sadam)", "Thengai Sadam (Coconut Rice)",
    "Elumichai Sadam (Lemon Rice)", "Ven Pongal", "Vada (Medu Vada)", "Kozhukattai", "Payasam", "Paal Payasam (Milk Kheer)",
    "Sabudana Khichdi", "Chole", "Puri", "Moong Dal Halwa", "Kheer (Rice Pudding)", "Jalebi",
  ],
  "Diwali (Deepavali)": [
    "Murukku", "Ribbon Pakoda", "Chakli", "Mathri", "Karanji", "Besan Ladoo", "Mysore Pak", "Jalebi", "Gulab Jamun",
    "Gajar Halwa", "Moong Dal Halwa", "Rava Kesari (Semolina Sweet)", "Kheer (Rice Pudding)", "Puri", "Chole",
    "Dahi Vada", "Kachori", "Samosa with Mint Chutney", "Aloo Tikki Chaat", "Paneer Butter Masala", "Vegetable Pulao",
  ],
  "Guru Nanak Gurpurab": [
    "Dal Makhani", "Dal Tadka", "Chole", "Puri", "Missi Roti", "Tandoori Roti", "Jeera Rice", "Aloo Gobi",
    "Kadhi Pakora", "Rajma Chawal", "Kheer (Rice Pudding)", "Moong Dal Halwa", "Lassi",
  ],
  "Christmas": [
    "Vegetable Pulao", "Vegetable Biryani", "Appam with Coconut Milk Stew", "Kerala Vegetable Stew (Ishtoo)", "Puttu with Kadala Curry",
    "Kheer (Rice Pudding)", "Payasam", "Gulab Jamun", "Gajar Halwa", "Rava Kesari (Semolina Sweet)", "Plum", "Badam Milk (Almond Milk)",
  ],
  "New Year's Day": [
    "Vegetable Biryani", "Paneer Butter Masala", "Shahi Paneer", "Dal Makhani", "Tandoori Roti", "Puri", "Samosa with Mint Chutney",
    "Bhel Puri", "Gulab Jamun", "Gajar Halwa", "Kheer (Rice Pudding)", "Rava Kesari (Semolina Sweet)", "Lassi",
  ],
  "Pongal / Makar Sankranti": [
    "Ven Pongal", "Pongal", "Payasam", "Paal Payasam (Milk Kheer)", "Vada (Medu Vada)", "Sambar", "Coconut Chutney", "Avial",
    "Kootu (Vegetable & Lentil Curry)", "Thoran (Vegetable Stir-fry with Coconut)", "Puliyodarai (Tamarind Rice)",
    "Thengai Sadam (Coconut Rice)", "Curd Rice (Thayir Sadam)", "Murukku", "Sundal (Spiced Chickpeas)",
    "Bajra Roti with Ghee and Jaggery", "Moong Dal Khichdi with Brown Rice",
  ],
  "Eid al-Fitr": [
    "Vegetable Biryani", "Vegetable Pulao", "Shahi Paneer", "Paneer Butter Masala", "Dal Makhani", "Dahi Vada",
    "Samosa with Mint Chutney", "Kheer (Rice Pudding)", "Gulab Jamun", "Jalebi", "Badam Milk (Almond Milk)", "Rose Milk", "Sheer Chai (Noon Chai)",
  ],
  "Holi": [
    "Thandai", "Gulab Jamun", "Jalebi", "Dahi Vada", "Dahi Bhalla", "Puri", "Chole", "Besan Ladoo", "Pani Puri",
    "Dhokla", "Karanji", "Mathri", "Kachori", "Aloo Tikki Chaat", "Bhel Puri", "Lassi",
  ],
  "Easter": [
    "Vegetable Pulao", "Appam with Coconut Milk Stew", "Kerala Vegetable Stew (Ishtoo)", "Puttu with Kadala Curry",
    "Kheer (Rice Pudding)", "Payasam", "Gajar Halwa", "Rava Kesari (Semolina Sweet)", "Badam Milk (Almond Milk)",
  ],
  "Tamil New Year (Puthandu)": [
    "Puliyodarai (Tamarind Rice)", "Elumichai Sadam (Lemon Rice)", "Curd Rice (Thayir Sadam)", "Sambar", "Rasam", "Avial",
    "Kootu (Vegetable & Lentil Curry)", "Thoran (Vegetable Stir-fry with Coconut)", "Vada (Medu Vada)", "Payasam",
    "Paal Payasam (Milk Kheer)", "Mysore Pak", "Rava Kesari (Semolina Sweet)", "Neer Mor (Spiced Buttermilk)", "Mango-Coconut Salad",
  ],
  "Baisakhi": [
    "Makki di Roti", "Dal Makhani", "Chole", "Puri", "Kadhi Pakora", "Rajma Chawal", "Aloo Gobi", "Kheer (Rice Pudding)", "Lassi", "Jalebi",
  ],
};

/** Every festival of the app's list that falls on this day (some share a date). */
export function builtInOn(date: string): string[] {
  return BUILT_IN_FESTIVALS.filter((f) => f.date === date).map((f) => f.name);
}

/** The dishes for the day's festivals, in order and without repeats; the general list for a family's own. */
export function festivalDishNames(builtIn: string[]): string[] {
  if (!builtIn.length) return GENERAL;
  const out: string[] = [];
  for (const n of builtIn) for (const d of FESTIVAL_DISHES[n] ?? []) if (!out.includes(d)) out.push(d);
  return out.length ? out : GENERAL;
}

/** "Dussehra (Vijayadashami)" → "Dussehra"; "Pongal / Makar Sankranti" → "Pongal" */
export function shortFestivalName(name: string): string {
  return name.replace(/\s*\(.*\)/, "").split(" / ")[0].trim();
}
