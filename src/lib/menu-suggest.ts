/**
 * Menu suggestions: the parts decided in code, never by the model.
 * The model only chooses dishes from a list already cut down by diet and
 * allergy; the weekly averages shown to the family are worked out here.
 */
import { dietsAllowed, dishTypeOf } from "./food-taxonomy.ts";

export const SUGGEST_SLOTS = ["breakfast", "morning_snack", "lunch", "evening_snack", "dinner"] as const;
export type SuggestSlot = (typeof SUGGEST_SLOTS)[number];

export type SuggestDish = {
  id: string;
  name: string;
  category: string | null;
  diet: string | null;
  meal_hint: string[] | null;
  calories: number | null;
  protein_g: number | null;
  serving_weight_g: number | null;
  serving_unit: string | null;
  ingredients: string | null;
  kutumbh_id: string | null;
};

export const SUGGEST_COLS = "id, name, category, diet, meal_hint, calories, protein_g, serving_weight_g, serving_unit, ingredients, kutumbh_id";

/** kcal and protein in one serving; a dish without figures borrows its type's usual kcal. */
export function perServing(d: SuggestDish): { kcal: number; protein: number | null } {
  const w = d.serving_unit === "g" ? 100 : (d.serving_weight_g ?? 100);
  if (d.calories == null) return { kcal: dishTypeOf(d.category).kcalPerServing, protein: null };
  return {
    kcal: (d.calories * w) / 100,
    protein: d.protein_g != null ? (d.protein_g * w) / 100 : null,
  };
}

/** True when a dish's name or ingredients mention something a member is allergic to. */
export function allergyHit(d: Pick<SuggestDish, "name" | "ingredients">, allergies: string[]): boolean {
  const text = `${d.name} ${d.ingredients ?? ""}`.toLowerCase();
  return allergies
    .map((a) => a.toLowerCase().replace(/s$/, "").trim())
    .filter((a) => a.length >= 3)
    .some((a) => text.includes(a));
}

/** Dishes the family menu may use: within the Key Member's diet, free of every member's allergens. */
export function eligibleDishes(dishes: SuggestDish[], keyDiet: string | null, allergies: string[]): SuggestDish[] {
  const ok = new Set<string>(dietsAllowed(keyDiet));
  return dishes.filter((d) => ok.has(d.diet ?? "veg") && !allergyHit(d, allergies));
}

export function windowDates(start: string, days = 7): string[] {
  const t = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(t + i * 86_400_000).toISOString().slice(0, 10));
}

export type MemberTarget = { id: string; name: string; kcal: number; protein: number };
export type PlannedDish = { date: string; slot: string; dishId: string };
export type AverageStatus = "good" | "watch" | "off";
export type MemberAverage = {
  id: string; name: string;
  kcal: number; kcalPct: number;
  protein: number; proteinPct: number;
  status: AverageStatus;
};

/** Share of the Good Range: 85–115% good, 70–130% worth a look, beyond that off. */
export function statusOf(pct: number): AverageStatus {
  const d = Math.abs(pct - 100);
  return d <= 15 ? "good" : d <= 30 ? "watch" : "off";
}
const worse = (a: AverageStatus, b: AverageStatus): AverageStatus =>
  a === "off" || b === "off" ? "off" : a === "watch" || b === "watch" ? "watch" : "good";

/**
 * Average per day over the window, one serving of every planned dish for each
 * member, against that member's own Good Range.
 */
export function weeklyAverages(
  plan: PlannedDish[], dishes: Map<string, SuggestDish>, members: MemberTarget[], days = 7,
): MemberAverage[] {
  let kcal = 0, protein = 0;
  for (const p of plan) {
    const d = dishes.get(p.dishId);
    if (!d) continue;
    const s = perServing(d);
    kcal += s.kcal;
    protein += s.protein ?? 0;
  }
  const k = kcal / days, p = protein / days;
  return members.map((m) => {
    const kcalPct = m.kcal > 0 ? Math.round((k / m.kcal) * 100) : 0;
    const proteinPct = m.protein > 0 ? Math.round((p / m.protein) * 100) : 0;
    return {
      id: m.id, name: m.name,
      kcal: Math.round(k), kcalPct,
      protein: Math.round(p), proteinPct,
      status: worse(statusOf(kcalPct), statusOf(proteinPct)),
    };
  });
}

/** What the model proposed → only slots that are empty, with dishes that passed the filter. */
export function cleanProposal(
  proposed: { date: string; slot: string; dish_ids: string[]; why: string }[],
  allowed: Map<string, SuggestDish>, window: string[], filled: Set<string>,
) {
  const dates = new Set(window);
  const slots = new Set<string>(SUGGEST_SLOTS);
  const seen = new Set<string>();
  const out: { date: string; slot: string; dishIds: string[]; why: string }[] = [];
  for (const p of proposed) {
    const key = `${p.date}|${p.slot}`;
    if (!dates.has(p.date) || !slots.has(p.slot) || filled.has(key) || seen.has(key)) continue;
    const ids = [...new Set(p.dish_ids)].filter((id) => allowed.has(id)).slice(0, 4);
    if (!ids.length) continue;
    seen.add(key);
    out.push({ date: p.date, slot: p.slot, dishIds: ids, why: p.why.slice(0, 160) });
  }
  return out;
}
