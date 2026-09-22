import type { IntakeSummary, LogEntry, NutrientKey, Nutrients } from "./types";

export const NUTRIENT_KEYS: NutrientKey[] = [
  "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g",
  "iron_mg", "calcium_mg", "vitamin_b12_mcg", "vitamin_c_mg",
  "folate_mcg", "sodium_mg", "potassium_mg",
];

// food_items column for each nutrient (kcal is stored as `calories`)
const FOOD_COL: Record<NutrientKey, keyof NonNullable<LogEntry["food"]>> = {
  kcal: "calories", protein_g: "protein_g", carbs_g: "carbs_g", fat_g: "fat_g", fiber_g: "fiber_g",
  iron_mg: "iron_mg", calcium_mg: "calcium_mg", vitamin_b12_mcg: "vitamin_b12_mcg",
  vitamin_c_mg: "vitamin_c_mg", folate_mcg: "folate_mcg", sodium_mg: "sodium_mg", potassium_mg: "potassium_mg",
};

export function zero(): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrients;
}

/** Grams eaten, when it can be known. */
export function gramsOf(e: LogEntry): number | null {
  if (!e.quantity_g || e.quantity_g <= 0) return null;
  if (e.quantity_unit === "g") return e.quantity_g;
  const w = e.food?.serving_weight_g;
  return w && w > 0 ? e.quantity_g * w : null;
}

/**
 * Nutrients for one log. kcal and protein prefer the values saved at log
 * time (they already reflect estimates and edited portions); everything
 * else comes from the food's per-100 g data × grams eaten.
 */
export function entryNutrients(e: LogEntry): { n: Nutrients; microKnown: boolean } {
  const n = zero();
  const g = gramsOf(e);
  const food = e.food;
  for (const k of NUTRIENT_KEYS) {
    const per100 = food ? (food[FOOD_COL[k]] as number | null) : null;
    if (per100 != null && g != null) n[k] = (per100 * g) / 100;
  }
  if (e.calories != null) n.kcal = e.calories;
  if (e.protein_g != null) n.protein_g = e.protein_g;
  const microKnown = !!(food && g != null && food.iron_mg != null);
  return { n, microKnown };
}

/** Every date from `from` to `to` inclusive (YYYY-MM-DD). */
export function datesBetween(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const out: string[] = [];
  const end = Date.UTC(ty, tm - 1, td);
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function summarizeIntake(entries: LogEntry[], from: string, to: string): IntakeSummary {
  const dates = datesBetween(from, to);
  const inRange = entries.filter((e) => e.logged_date >= from && e.logged_date <= to);

  const totals = zero();
  const byDay = new Map<string, number>(dates.map((d) => [d, 0]));
  let microKcal = 0;
  let estKcal = 0;

  for (const e of inRange) {
    const { n, microKnown } = entryNutrients(e);
    for (const k of NUTRIENT_KEYS) totals[k] += n[k];
    byDay.set(e.logged_date, (byDay.get(e.logged_date) ?? 0) + n.kcal);
    if (microKnown) microKcal += n.kcal;
    if (e.nutrition_estimated) estKcal += n.kcal;
  }

  const loggedDays = new Set(inRange.map((e) => e.logged_date)).size;
  const perDay = zero();
  if (loggedDays > 0) for (const k of NUTRIENT_KEYS) perDay[k] = totals[k] / loggedDays;

  return {
    days: dates.length,
    loggedDays,
    items: inRange.length,
    perDay,
    daily: dates.map((d) => ({ date: d, kcal: Math.round(byDay.get(d) ?? 0) })),
    microCoverage: totals.kcal > 0 ? microKcal / totals.kcal : 0,
    estimatedShare: totals.kcal > 0 ? estKcal / totals.kcal : 0,
  };
}
