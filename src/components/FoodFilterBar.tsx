"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slotLabel } from "@/lib/meal-slots";
import {
  CUISINES, DIETS, DISH_TYPES, INDIAN_CUISINES, dietsAllowed,
  type Cuisine, type Diet, type DishType,
} from "@/lib/food-taxonomy";

// A. Cuisine ("indian" = every Indian region) → B. Diet (show dishes up to
// this diet) → C. Dish type ("" = all types). mealOnly keeps the list to
// dishes that suit the meal being planned or logged.
export type FoodFilter = { cuisine: "indian" | "all" | Cuisine; diet: Diet; type: DishType | ""; mealOnly: boolean };

export const DEFAULT_FILTER: FoodFilter = { cuisine: "indian", diet: "veg", type: "", mealOnly: true };

type Filterable<Q> = { or(filters: string): Q; eq(column: string, value: string): Q };

/** PostgREST "or" filter: dishes at or below this diet (unclassified count as Veg). */
export function dietOr(diet: Diet): string {
  const rank = DIETS.find((d) => d.key === diet)?.rank ?? 1;
  const keys = DIETS.filter((d) => d.rank <= rank).map((d) => d.key);
  return rank >= 1 ? `diet.is.null,diet.in.(${keys.join(",")})` : `diet.in.(${keys.join(",")})`;
}

/**
 * Adds the filters to a food_items query. Family Dishes made before the
 * classification may have no cuisine or diet yet: they count as Indian / Veg.
 * Family Dishes with no meal set show at every meal.
 * While searching by name, only the diet applies.
 */
export function applyFoodFilter<Q extends Filterable<Q>>(q: Q, f: FoodFilter, searching: boolean, slot: string | null): Q {
  q = q.or(dietOr(f.diet));
  if (searching) return q;
  if (f.mealOnly && slot) q = q.or(`meal_hint.cs.{${slot}},and(meal_hint.is.null,kutumbh_id.not.is.null)`);
  if (f.cuisine === "indian") q = q.or(`cuisine.is.null,cuisine.in.(${INDIAN_CUISINES.join(",")})`);
  else if (f.cuisine !== "all") q = q.eq("cuisine", f.cuisine);
  if (f.type) q = q.eq("category", f.type);
  return q;
}

/** Dishes usually eaten at this meal first; the rest keep their order. */
export function sortForSlot<T extends { meal_hint?: string[] | null }>(items: T[], slot: string | null): T[] {
  if (!slot) return items;
  const fits = (i: T) => (i.meal_hint ?? []).includes(slot);
  return [...items.filter(fits), ...items.filter((i) => !fits(i))];
}

/** Starts the Diet filter at the person's own diet from their profile. */
export function useMyFoodFilter() {
  const [filter, setFilter] = useState<FoodFilter>(DEFAULT_FILTER);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("diet_type").eq("id", data.user.id).maybeSingle();
      const allowed = dietsAllowed(p?.diet_type);
      setFilter((f) => ({ ...f, diet: allowed[allowed.length - 1] }));
    });
  }, []);
  return [filter, setFilter] as const;
}

const DIET_MARK: Record<Diet, string> = { vegan: "#2F7D32", veg: "#2F7D32", egg: "#C98A0B", nonveg: "#A23A1E" };

/** The Indian veg / non-veg mark: a dot in a square, coloured by diet. */
export function DietMark({ diet }: { diet: string | null | undefined }) {
  const c = DIET_MARK[(diet as Diet) ?? "veg"] ?? DIET_MARK.veg;
  return (
    <span aria-label={DIETS.find((d) => d.key === diet)?.label ?? "Veg"} role="img"
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: 12, height: 12, border: `1.5px solid ${c}`, borderRadius: 2 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
    </span>
  );
}

const selectStyle = {
  border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none",
} as const;

export default function FoodFilterBar({ value, onChange, idPrefix, slot }: {
  value: FoodFilter; onChange: (f: FoodFilter) => void; idPrefix: string; slot: string;
}) {
  const meal = slotLabel(slot);
  return (
    <div className="grid gap-2">
      <div className="flex rounded-full p-0.5 text-xs font-semibold" style={{ background: "#E2E1D8" }} role="group" aria-label="Which dishes to show">
        {[{ on: true, label: `${meal} dishes` }, { on: false, label: "All meals" }].map((o) => (
          <button key={o.label} type="button" onClick={() => onChange({ ...value, mealOnly: o.on })}
            aria-pressed={value.mealOnly === o.on}
            className="flex-1 py-1.5 rounded-full"
            style={value.mealOnly === o.on ? { background: "#1C2B1C", color: "#fff" } : { color: "#5A6055" }}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${idPrefix}-cuisine`} className="block text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#8A9085" }}>
            Cuisine
          </label>
          <select id={`${idPrefix}-cuisine`} value={value.cuisine}
            onChange={(e) => onChange({ ...value, cuisine: e.target.value as FoodFilter["cuisine"] })}
            className="w-full rounded-lg px-2 py-1.5 text-xs" style={selectStyle}>
            <option value="indian">Indian (all regions)</option>
            <optgroup label="Indian regions">
              {CUISINES.filter((c) => c.indian).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </optgroup>
            <optgroup label="World">
              {CUISINES.filter((c) => !c.indian).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </optgroup>
            <option value="all">Every cuisine</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-diet`} className="block text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#8A9085" }}>
            Diet
          </label>
          <select id={`${idPrefix}-diet`} value={value.diet}
            onChange={(e) => onChange({ ...value, diet: e.target.value as Diet })}
            className="w-full rounded-lg px-2 py-1.5 text-xs" style={selectStyle}>
            <option value="vegan">Vegan only</option>
            <option value="veg">Veg (incl. vegan)</option>
            <option value="egg">Veg + Egg</option>
            <option value="nonveg">Everything incl. non-veg</option>
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} role="group" aria-label="Dish type">
        {[{ key: "" as const, label: "All types", icon: "" }, ...DISH_TYPES].map((t) => (
          <button key={t.key || "all"} type="button" onClick={() => onChange({ ...value, type: t.key })}
            aria-pressed={value.type === t.key}
            className="shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium"
            style={value.type === t.key
              ? { background: "#1C2B1C", color: "#fff" }
              : { background: "#E2E1D8", color: "#5A6055" }}>
            {t.icon ? `${t.icon} ` : ""}{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
