import { MEAL_KEYS, type MealKey } from "@/lib/festivals";

export type DishInfo = { id: string; name: string; category: string | null; serving_unit: string | null };
export type StarterItem = { meal: MealKey; id: string; name: string; unit: string | null };

// Each meal takes dishes of different kinds: one entry per dish, listing the
// dish types that fit it, most wanted first. Breakfast, lunch, the evening
// snack and dinner get two; the morning snack gets one. Across the day that
// makes a drink, a staple, a main, a snack and a sweet.
const ROLES: Record<MealKey, string[][]> = {
  breakfast:     [["main", "staple"], ["curry", "side", "dal", "sambar", "chutney", "drink", "dairy"]],
  morning_snack: [["drink", "fruit", "dairy"]],
  lunch:         [["main", "staple"], ["curry", "dal", "side", "sambar", "rasam"]],
  evening_snack: [["snack"], ["dessert", "drink"]],
  dinner:        [["staple", "main"], ["dessert", "curry", "dal", "side"]],
};

/** The festival's dishes in order of tradition (the list from festivalMenu), one dish per role. */
export function starterMenu(candidates: { name: string; meal: MealKey }[], info: Map<string, DishInfo>): StarterItem[] {
  const out: StarterItem[] = [];
  const used = new Set<string>();
  for (const meal of MEAL_KEYS) {
    const pool = candidates.filter((c) => c.meal === meal).map((c) => info.get(c.name)).filter((d): d is DishInfo => !!d);
    for (const kinds of ROLES[meal]) {
      const pick = kinds.map((k) => pool.find((d) => d.category === k && !used.has(d.id))).find(Boolean)
        ?? pool.find((d) => !used.has(d.id));
      if (!pick) continue;
      used.add(pick.id);
      out.push({ meal, id: pick.id, name: pick.name, unit: pick.serving_unit });
    }
  }
  return out;
}
