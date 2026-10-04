// What one serving of a dish holds, worked from the per-100 g values kept
// on the dish. A dish whose calories are not filled in has no values yet.
export type Nutr = {
  kcal: number; fat: number; p: number; c: number; fi: number;
  fe: number; na: number; k: number; ca: number; b12: number;
};

export const ZERO: Nutr = { kcal: 0, fat: 0, p: 0, c: 0, fi: 0, fe: 0, na: 0, k: 0, ca: 0, b12: 0 };

export const FOOD_NUTRIENT_COLS =
  "calories, protein_g, carbs_g, fat_g, fiber_g, iron_mg, sodium_mg, potassium_mg, calcium_mg, vitamin_b12_mcg, serving_unit, serving_weight_g";

export type FoodNutrientRow = {
  calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
  fiber_g: number | null; iron_mg: number | null; sodium_mg: number | null; potassium_mg: number | null;
  calcium_mg: number | null; vitamin_b12_mcg: number | null;
  serving_unit: string | null; serving_weight_g: number | null;
};

export function perServing(f: FoodNutrientRow | null | undefined): Nutr | null {
  if (!f || f.calories == null) return null;
  const w = (f.serving_unit === "g" ? 100 : (f.serving_weight_g ?? 100)) / 100;
  const v = (x: number | null) => (x == null ? 0 : Number(x) * w);
  return {
    kcal: v(f.calories), fat: v(f.fat_g), p: v(f.protein_g), c: v(f.carbs_g), fi: v(f.fiber_g),
    fe: v(f.iron_mg), na: v(f.sodium_mg), k: v(f.potassium_mg), ca: v(f.calcium_mg), b12: v(f.vitamin_b12_mcg),
  };
}

export function scaled(n: Nutr, times: number): Nutr {
  const o = { ...n } as Nutr;
  (Object.keys(o) as (keyof Nutr)[]).forEach((k) => { o[k] = n[k] * times; });
  return o;
}

export function sum(list: Nutr[]): Nutr {
  const t = { ...ZERO };
  for (const n of list) (Object.keys(t) as (keyof Nutr)[]).forEach((k) => { t[k] += n[k]; });
  return t;
}

const r = (x: number, d = 0) => (d ? (Math.round(x * 10) / 10).toLocaleString("en-IN") : Math.round(x).toLocaleString("en-IN"));

export const nutrientCells = (t: Nutr) => [
  { label: "Kcal", value: r(t.kcal) }, { label: "Protein g", value: r(t.p, 1) }, { label: "Carbs g", value: r(t.c) },
  { label: "Fat g", value: r(t.fat, 1) }, { label: "Fibre g", value: r(t.fi, 1) },
];
export const microCells = (t: Nutr) => [
  { label: "Iron mg", value: r(t.fe, 1) }, { label: "Sodium mg", value: r(t.na) }, { label: "Potas. mg", value: r(t.k) },
  { label: "Calcium mg", value: r(t.ca) }, { label: "B12 µg", value: r(t.b12, 1) },
];
