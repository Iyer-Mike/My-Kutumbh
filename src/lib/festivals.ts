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
// the dish catalogue, grouped by meal: what is made for that festival across
// Indian homes first, then everyday dishes so every meal has at least five.
export type MealKey = "breakfast" | "morning_snack" | "lunch" | "evening_snack" | "dinner";
export const MEAL_KEYS: MealKey[] = ["breakfast", "morning_snack", "lunch", "evening_snack", "dinner"];
type Menu = Partial<Record<MealKey, string[]>>;

const EVERYDAY: Record<MealKey, string[]> = {
  breakfast: ["Idli with Sambar", "Dosa", "Vegetable Uttapam", "Poha (Flattened Rice Stir-Fry)", "Rava Upma", "Aloo Paratha", "Besan Chilla (Gram Flour Crepe)", "Moong Dal Cheela"],
  morning_snack: ["Seasonal Fruit Bowl", "Banana", "Dates (dry)", "Roasted Makhana", "Tender Coconut Water", "Pomegranate", "Filter Coffee", "Masala Chai"],
  lunch: ["Vegetable Pulao", "Dal Tadka", "Jeera Rice", "Phulka", "Aloo Gobi", "Sambar", "Plain Rice", "Kootu (Vegetable & Lentil Curry)"],
  evening_snack: ["Murukku", "Samosa with Mint Chutney", "Gulab Jamun", "Besan Ladoo", "Payasam", "Dhokla", "Bhel Puri", "Masala Bajji (Vegetable Fritters)"],
  dinner: ["Chapati (Roti)", "Khichdi", "Tandoori Roti", "Paneer Bhurji", "Palak Paneer", "Matar Paneer", "Mixed Dal (Moong-Masoor)", "Tomato Shorba"],
};

export const FESTIVAL_MENUS: Record<string, Menu> = {
  "Dussehra (Vijayadashami)": {
    breakfast: ["Ven Pongal", "Idli with Sambar", "Pesarattu", "Adai (Mixed Lentil Crepe)"],
    morning_snack: ["Sundal (Spiced Chickpeas)", "Banana", "Badam Milk (Almond Milk)"],
    lunch: ["Puliyodarai (Tamarind Rice)", "Elumichai Sadam (Lemon Rice)", "Thengai Sadam (Coconut Rice)", "Curd Rice (Thayir Sadam)", "Sambar Sadam (Sambar Rice)"],
    evening_snack: ["Vada (Medu Vada)", "Kozhukattai", "Payasam", "Paal Payasam (Milk Kheer)", "Kheer (Rice Pudding)", "Jalebi"],
    dinner: ["Sabudana Khichdi", "Chole", "Puri", "Moong Dal Halwa"],
  },
  "Diwali (Deepavali)": {
    breakfast: ["Puri", "Chole", "Aloo Paratha", "Idli with Sambar", "Dosa"],
    morning_snack: ["Badam Milk (Almond Milk)", "Thandai", "Dates (dry)", "Fig (Anjeer)"],
    lunch: ["Paneer Butter Masala", "Shahi Paneer", "Vegetable Pulao", "Dal Makhani", "Vegetable Biryani"],
    evening_snack: ["Murukku", "Ribbon Pakoda", "Chakli", "Mathri", "Karanji", "Besan Ladoo", "Mysore Pak", "Jalebi", "Gulab Jamun", "Kachori"],
    dinner: ["Kheer (Rice Pudding)", "Gajar Halwa", "Moong Dal Halwa", "Rava Kesari (Semolina Sweet)", "Dahi Vada"],
  },
  "Guru Nanak Gurpurab": {
    breakfast: ["Aloo Paratha", "Paneer Paratha", "Chole", "Bhatura", "Lassi"],
    morning_snack: ["Lassi", "Masala Chai", "Banana"],
    lunch: ["Dal Makhani", "Chole", "Rajma Chawal", "Kadhi Pakora", "Jeera Rice", "Makki di Roti"],
    evening_snack: ["Onion Pakora", "Kachori", "Samosa with Mint Chutney", "Jalebi"],
    dinner: ["Missi Roti", "Dal Tadka", "Aloo Gobi", "Kheer (Rice Pudding)", "Moong Dal Halwa"],
  },
  "Christmas": {
    breakfast: ["Appam with Coconut Milk Stew", "Puttu with Kadala Curry", "Idiyappam with Coconut Milk"],
    morning_snack: ["Plum", "Grapes", "Badam Milk (Almond Milk)", "Apple"],
    lunch: ["Vegetable Biryani", "Vegetable Pulao", "Kerala Vegetable Stew (Ishtoo)", "Avial", "Thoran (Vegetable Stir-fry with Coconut)"],
    evening_snack: ["Kheer (Rice Pudding)", "Payasam", "Gulab Jamun", "Gajar Halwa", "Rava Kesari (Semolina Sweet)", "Pazham Pori"],
    dinner: ["Mushroom Risotto", "Gnocchi al Pomodoro", "Potato Gratin", "Minestrone Soup", "Vegetarian Shepherd's Pie"],
  },
  "New Year's Day": {
    breakfast: ["Pav Bhaji", "Aloo Paratha", "Paneer Paratha", "Misal Pav"],
    morning_snack: ["Seasonal Fruit Bowl", "Masala Chai"],
    lunch: ["Vegetable Biryani", "Paneer Butter Masala", "Shahi Paneer", "Dal Makhani", "Tandoori Roti"],
    evening_snack: ["Samosa with Mint Chutney", "Bhel Puri", "Pani Puri", "Aloo Tikki Chaat", "Gulab Jamun", "Gajar Halwa"],
    dinner: ["Vegetable Pulao", "Mushroom Risotto", "Kheer (Rice Pudding)", "Rava Kesari (Semolina Sweet)"],
  },
  "Pongal / Makar Sankranti": {
    breakfast: ["Ven Pongal", "Pongal", "Idli with Sambar", "Vada (Medu Vada)", "Pesarattu"],
    morning_snack: ["Tender Coconut Water", "Banana", "Sundal (Spiced Chickpeas)", "Filter Coffee"],
    lunch: ["Puliyodarai (Tamarind Rice)", "Thengai Sadam (Coconut Rice)", "Curd Rice (Thayir Sadam)", "Avial", "Kootu (Vegetable & Lentil Curry)", "Thoran (Vegetable Stir-fry with Coconut)", "Rasam", "Sambar"],
    evening_snack: ["Payasam", "Paal Payasam (Milk Kheer)", "Murukku", "Sundal (Spiced Chickpeas)"],
    dinner: ["Bajra Roti with Ghee and Jaggery", "Moong Dal Khichdi with Brown Rice", "Rava Idli", "Dosa"],
  },
  "Eid al-Fitr": {
    breakfast: ["Puri", "Chole", "Aloo Paratha"],
    morning_snack: ["Sheer Chai (Noon Chai)", "Badam Milk (Almond Milk)", "Dates (dry)", "Rose Milk"],
    lunch: ["Vegetable Biryani", "Shahi Paneer", "Paneer Butter Masala", "Dal Makhani", "Tandoori Roti", "Boondi Raita"],
    evening_snack: ["Samosa with Mint Chutney", "Dahi Vada", "Kheer (Rice Pudding)", "Gulab Jamun", "Jalebi"],
    dinner: ["Vegetable Pulao", "Dal Tadka", "Palak Paneer"],
  },
  "Holi": {
    breakfast: ["Aloo Paratha", "Puri", "Chole", "Kachori"],
    morning_snack: ["Thandai", "Lassi", "Rose Milk", "Seasonal Fruit Bowl"],
    lunch: ["Dahi Bhalla", "Dahi Vada", "Puri", "Chole", "Kadhi Pakora"],
    evening_snack: ["Gulab Jamun", "Jalebi", "Besan Ladoo", "Pani Puri", "Dhokla", "Karanji", "Mathri", "Aloo Tikki Chaat", "Bhel Puri"],
    dinner: ["Vegetable Pulao", "Dal Tadka", "Aloo Gobi"],
  },
  "Easter": {
    breakfast: ["Appam with Coconut Milk Stew", "Puttu with Kadala Curry", "Idiyappam with Coconut Milk"],
    morning_snack: ["Badam Milk (Almond Milk)", "Plum", "Grapes"],
    lunch: ["Vegetable Pulao", "Kerala Vegetable Stew (Ishtoo)", "Avial", "Thoran (Vegetable Stir-fry with Coconut)", "Vegetable Biryani"],
    evening_snack: ["Kheer (Rice Pudding)", "Payasam", "Gajar Halwa", "Rava Kesari (Semolina Sweet)", "Pazham Pori"],
    dinner: ["Mushroom Risotto", "Minestrone Soup", "Gnocchi al Pomodoro"],
  },
  "Tamil New Year (Puthandu)": {
    breakfast: ["Ven Pongal", "Idli with Sambar", "Vada (Medu Vada)", "Adai (Mixed Lentil Crepe)"],
    morning_snack: ["Neer Mor (Spiced Buttermilk)", "Mango", "Nimbu Pani (Indian Lemonade)"],
    lunch: ["Puliyodarai (Tamarind Rice)", "Elumichai Sadam (Lemon Rice)", "Curd Rice (Thayir Sadam)", "Sambar", "Rasam", "Avial", "Kootu (Vegetable & Lentil Curry)", "Thoran (Vegetable Stir-fry with Coconut)", "Mango-Coconut Salad"],
    evening_snack: ["Payasam", "Paal Payasam (Milk Kheer)", "Mysore Pak", "Rava Kesari (Semolina Sweet)", "Murukku"],
    dinner: ["Dosa", "Idli", "Rava Upma"],
  },
  "Baisakhi": {
    breakfast: ["Aloo Paratha", "Makki di Roti", "Chole", "Bhatura", "Paneer Paratha"],
    morning_snack: ["Lassi", "Chaas (Spiced Buttermilk)"],
    lunch: ["Dal Makhani", "Chole", "Kadhi Pakora", "Rajma Chawal", "Makki di Roti"],
    evening_snack: ["Jalebi", "Samosa with Mint Chutney", "Kheer (Rice Pudding)", "Onion Pakora"],
    dinner: ["Missi Roti", "Dal Tadka", "Aloo Gobi"],
  },
};

// A festival of the family's own gets a general festive menu
const GENERAL: Menu = {
  lunch: ["Vegetable Pulao", "Curd Rice (Thayir Sadam)"],
  evening_snack: ["Payasam", "Gulab Jamun", "Besan Ladoo", "Mysore Pak"],
};

const CAP = 10;

/** Dish name → the meal it is offered under, for the day's festivals; each dish once, at least five per meal. */
export function festivalMenu(builtIn: string[]): { name: string; meal: MealKey }[] {
  const menus = builtIn.length ? builtIn.map((n) => FESTIVAL_MENUS[n] ?? {}) : [GENERAL];
  const used = new Set<string>();
  const out: { name: string; meal: MealKey }[] = [];
  for (const meal of MEAL_KEYS) {
    const picked: string[] = [];
    for (const m of [...menus.map((x) => x[meal] ?? []), EVERYDAY[meal]])
      for (const d of m) if (!used.has(d) && !picked.includes(d) && picked.length < CAP) picked.push(d);
    for (const d of picked) { used.add(d); out.push({ name: d, meal }); }
  }
  return out;
}

/** Every festival of the app's list that falls on this day (some share a date). */
export function builtInOn(date: string): string[] {
  return BUILT_IN_FESTIVALS.filter((f) => f.date === date).map((f) => f.name);
}

/** "Dussehra (Vijayadashami)" → "Dussehra"; "Pongal / Makar Sankranti" → "Pongal" */
export function shortFestivalName(name: string): string {
  return name.replace(/\s*\(.*\)/, "").split(" / ")[0].trim();
}
