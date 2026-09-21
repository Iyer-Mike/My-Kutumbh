// Starting estimates per dish category, used only until the Prime Member
// completes a Family Dish with its real values. Rough home-style averages
// for one typical serving — not clinical figures.
export type DishCategory =
  | "grain" | "legume" | "vegetable" | "fruit" | "dairy"
  | "snack" | "sweet" | "beverage" | "other";

export const DISH_CATEGORIES: {
  key: DishCategory; label: string; icon: string;
  unit: string; servingG: number; kcalPerServing: number;
}[] = [
  { key: "grain",     label: "Rice / Tiffin",   icon: "🍚", unit: "serving", servingG: 150, kcalPerServing: 200 },
  { key: "legume",    label: "Dal / Sambar",    icon: "🥣", unit: "bowl",    servingG: 150, kcalPerServing: 150 },
  { key: "vegetable", label: "Curry / Poriyal", icon: "🥦", unit: "bowl",    servingG: 120, kcalPerServing: 110 },
  { key: "dairy",     label: "Curd / Milk",     icon: "🥛", unit: "cup",     servingG: 150, kcalPerServing: 100 },
  { key: "fruit",     label: "Fruit",           icon: "🍎", unit: "piece",   servingG: 120, kcalPerServing: 70  },
  { key: "snack",     label: "Snack",           icon: "🥨", unit: "serving", servingG: 60,  kcalPerServing: 220 },
  { key: "sweet",     label: "Sweet",           icon: "🍮", unit: "piece",   servingG: 50,  kcalPerServing: 200 },
  { key: "beverage",  label: "Drink",           icon: "☕", unit: "cup",     servingG: 150, kcalPerServing: 90  },
  { key: "other",     label: "Other",           icon: "🍽️", unit: "serving", servingG: 150, kcalPerServing: 180 },
];

export function categoryDefaults(category: string | null | undefined) {
  return DISH_CATEGORIES.find((c) => c.key === category) ?? DISH_CATEGORIES[DISH_CATEGORIES.length - 1];
}
