// Three-layer food classification: A. Cuisine → B. Diet → C. Dish type.
// Indian is the default cuisine. Used by the Plan and Log pickers, the
// Family Dishes editor, the dish estimator and the recipe import.

// ── A. Cuisine ────────────────────────────────────
export type Cuisine =
  | "south_indian" | "north_indian" | "west_indian" | "east_indian" | "northeast_indian" | "pan_indian"
  | "asian" | "middle_eastern" | "african" | "european" | "latin_american";

export const CUISINES: { key: Cuisine; label: string; indian: boolean; examples: string }[] = [
  { key: "south_indian",     label: "South Indian",     indian: true,  examples: "Tamil, Kerala, Karnataka, Andhra, Telangana, Chettinad, Udupi" },
  { key: "north_indian",     label: "North Indian",     indian: true,  examples: "Punjabi, Kashmiri, Rajasthani, Awadhi, Himachali, UP" },
  { key: "west_indian",      label: "West Indian",      indian: true,  examples: "Maharashtrian, Gujarati, Goan, Konkani, Sindhi, Parsi" },
  { key: "east_indian",      label: "East Indian",      indian: true,  examples: "Bengali, Odia, Bihari, Jharkhandi" },
  { key: "northeast_indian", label: "North-East Indian", indian: true, examples: "Assamese, Naga, Manipuri, Meghalayan, Sikkimese" },
  { key: "pan_indian",       label: "All-India",        indian: true,  examples: "Eaten everywhere in India: plain rice, roti, curd, fruit, tea" },
  { key: "asian",            label: "Asian",            indian: false, examples: "Sri Lankan, South-East Asian, Chinese, Japanese, Korean" },
  { key: "middle_eastern",   label: "Middle Eastern",   indian: false, examples: "Lebanese, Turkish, Persian, North African" },
  { key: "african",          label: "African",          indian: false, examples: "West and East African" },
  { key: "european",         label: "European",         indian: false, examples: "Italian, French, British, Mediterranean" },
  { key: "latin_american",   label: "Latin American",   indian: false, examples: "Mexican, South American" },
];

export const INDIAN_CUISINES = CUISINES.filter((c) => c.indian).map((c) => c.key);

// ── B. Diet ───────────────────────────────────────
// Each dish carries the strictest diet it fits. A person sees every dish at
// or below their own diet: a vegetarian sees Vegan + Veg, and so on.
export type Diet = "vegan" | "veg" | "egg" | "nonveg";

export const DIETS: { key: Diet; label: string; rank: number }[] = [
  { key: "vegan",  label: "Vegan",   rank: 0 },
  { key: "veg",    label: "Veg",     rank: 1 },
  { key: "egg",    label: "Egg",     rank: 2 },
  { key: "nonveg", label: "Non-veg", rank: 3 },
];

/** Profile diet_type → the dish diets that person can eat. */
export function dietsAllowed(dietType: string | null | undefined): Diet[] {
  const t = (dietType ?? "").toLowerCase();
  const max = /vegan/.test(t) ? 0 : /egg/.test(t) ? 2 : /non|omni|meat|fish|pesc/.test(t) ? 3 : /veg|jain/.test(t) ? 1 : 3;
  return DIETS.filter((d) => d.rank <= max).map((d) => d.key);
}

// ── C. Dish type ──────────────────────────────────
// Stored in food_items.category. Each type has a natural serving and the
// starting estimate used until a Family Dish gets its real values.
export type DishType =
  | "staple" | "main" | "dal" | "sambar" | "rasam" | "curry" | "side" | "snack" | "salad" | "fruit"
  | "dairy" | "drink" | "dessert" | "soup" | "chutney" | "pickle" | "podi" | "extras";

export const DISH_TYPES: {
  key: DishType; label: string; icon: string; hint: string;
  unit: string; servingG: number; kcalPerServing: number;
}[] = [
  { key: "staple",  label: "Staple",               icon: "🍚", hint: "Rice, roti, millet — the base of a meal",        unit: "serving", servingG: 150, kcalPerServing: 200 },
  { key: "main",    label: "Main dish",            icon: "🍛", hint: "Complete on its own: dosa, idli, biryani, pongal", unit: "plate",   servingG: 250, kcalPerServing: 330 },
  { key: "dal",     label: "Dal & Kootu",          icon: "🥣", hint: "Dals, kootu, kadhi, pappu",                     unit: "bowl",    servingG: 150, kcalPerServing: 150 },
  { key: "sambar",  label: "Sambar",               icon: "🥘", hint: "Sambar, in its many kinds",                     unit: "bowl",    servingG: 150, kcalPerServing: 120 },
  { key: "rasam",   label: "Rasam",                icon: "🥄", hint: "Rasam, saaru, charu — thin and peppery",         unit: "bowl",    servingG: 150, kcalPerServing: 60  },
  { key: "curry",   label: "Curries & gravies",    icon: "🍲", hint: "Gravy dishes: paneer, chole, kurma, fish curry", unit: "bowl",    servingG: 150, kcalPerServing: 180 },
  { key: "side",    label: "Side dish",            icon: "🥦", hint: "Dry sabzi, poriyal, thoran, fry",               unit: "bowl",    servingG: 100, kcalPerServing: 110 },
  { key: "snack",   label: "Snacks / Tiffin",      icon: "🥨", hint: "Vada, samosa, sundal, murukku, chaat",          unit: "serving", servingG: 60,  kcalPerServing: 200 },
  { key: "salad",   label: "Salads & raw veg",     icon: "🥗", hint: "Kosambari, salads, raw vegetables",             unit: "bowl",    servingG: 100, kcalPerServing: 50  },
  { key: "fruit",   label: "Fruits",               icon: "🍎", hint: "Whole and cut fruit",                           unit: "piece",   servingG: 120, kcalPerServing: 70  },
  { key: "dairy",   label: "Dairy",                icon: "🥛", hint: "Curd, buttermilk, milk, paneer",                unit: "cup",     servingG: 150, kcalPerServing: 100 },
  { key: "drink",   label: "Drinks & beverages",   icon: "☕", hint: "Tea, coffee, juices, lassi, panakam",           unit: "glass",   servingG: 200, kcalPerServing: 90  },
  { key: "dessert", label: "Desserts & sweets",    icon: "🍮", hint: "Payasam, halwa, ladoo, mithai",                 unit: "piece",   servingG: 60,  kcalPerServing: 220 },
  { key: "soup",    label: "Soups",                icon: "🍵", hint: "Soups and shorba",                              unit: "bowl",    servingG: 200, kcalPerServing: 90  },
  { key: "chutney", label: "Chutneys",             icon: "🫙", hint: "Coconut, tomato, mint chutney; thuvaiyal",      unit: "tbsp",    servingG: 30,  kcalPerServing: 50  },
  { key: "pickle",  label: "Pickles",              icon: "🥭", hint: "Oorugai, achaar",                               unit: "tsp",     servingG: 10,  kcalPerServing: 25  },
  { key: "podi",    label: "Podis (powders)",      icon: "🧂", hint: "Idli podi, paruppu podi, curry leaf podi",      unit: "tsp",     servingG: 10,  kcalPerServing: 35  },
  { key: "extras",  label: "Extras & ingredients", icon: "🥥", hint: "Ghee, nuts, grated coconut, lemon, papad",      unit: "serving", servingG: 20,  kcalPerServing: 100 },
];

export function dishTypeOf(key: string | null | undefined) {
  return DISH_TYPES.find((d) => d.key === key) ?? DISH_TYPES[DISH_TYPES.length - 1];
}

export const cuisineLabel = (k: string | null | undefined) => CUISINES.find((c) => c.key === k)?.label ?? "Indian";
export const dietLabel = (k: string | null | undefined) => DIETS.find((d) => d.key === k)?.label ?? "Veg";
