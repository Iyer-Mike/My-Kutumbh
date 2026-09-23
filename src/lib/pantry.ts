// The Pantry Shelf: what the kitchen holds, in the three ways stock behaves.
export type Kind = "staple" | "fresh" | "sundry";
export type Status = "ok" | "low" | "out";
export type Unit = "kg" | "g" | "l" | "ml" | "packet" | "piece" | "bunch" | "dozen";

export const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "staple", label: "Staples",            hint: "Rice, dals, atta, oil, sugar — kept by weight" },
  { key: "fresh",  label: "Fresh",              hint: "Vegetables, milk, curd — bought often, used soon" },
  { key: "sundry", label: "Spices & sundries",  hint: "Nobody weighs haldi — just OK, low or out" },
];

export const CATEGORIES: { key: string; label: string; kind: Kind }[] = [
  { key: "grain",     label: "Grain / rice",   kind: "staple" },
  { key: "dal",       label: "Dal / pulses",   kind: "staple" },
  { key: "flour",     label: "Flour",          kind: "staple" },
  { key: "oil",       label: "Oil / ghee",     kind: "staple" },
  { key: "dry_fruit", label: "Nuts & dry fruit", kind: "staple" },
  { key: "ready",     label: "Ready / packet", kind: "staple" },
  { key: "vegetable", label: "Vegetables",     kind: "fresh" },
  { key: "fruit",     label: "Fruit",          kind: "fresh" },
  { key: "dairy",     label: "Milk & curd",    kind: "fresh" },
  { key: "spice",     label: "Spices",         kind: "sundry" },
  { key: "other",     label: "Other",          kind: "sundry" },
];

export const UNITS: Unit[] = ["kg", "g", "l", "ml", "packet", "piece", "bunch", "dozen"];

/** How long a fresh item usually keeps, in days. */
export const SHELF_LIFE: Record<string, number> = {
  vegetable: 5, fruit: 5, dairy: 3,
};

/** A starting shelf for a kitchen that has none yet. */
export const STARTER: { name: string; kind: Kind; category: string; unit?: Unit; quantity?: number; low_when?: number }[] = [
  { name: "Rice",            kind: "staple", category: "grain", unit: "kg", quantity: 5, low_when: 1 },
  { name: "Wheat atta",      kind: "staple", category: "flour", unit: "kg", quantity: 5, low_when: 1 },
  { name: "Toor dal",        kind: "staple", category: "dal",   unit: "kg", quantity: 1, low_when: 0.25 },
  { name: "Moong dal",       kind: "staple", category: "dal",   unit: "kg", quantity: 1, low_when: 0.25 },
  { name: "Urad dal",        kind: "staple", category: "dal",   unit: "kg", quantity: 1, low_when: 0.25 },
  { name: "Cooking oil",     kind: "staple", category: "oil",   unit: "l",  quantity: 1, low_when: 0.25 },
  { name: "Ghee",            kind: "staple", category: "oil",   unit: "ml", quantity: 500, low_when: 100 },
  { name: "Sugar",           kind: "staple", category: "ready", unit: "kg", quantity: 1, low_when: 0.25 },
  { name: "Milk",            kind: "fresh",  category: "dairy", unit: "l",  quantity: 1 },
  { name: "Curd",            kind: "fresh",  category: "dairy", unit: "g",  quantity: 500 },
  { name: "Onion",           kind: "fresh",  category: "vegetable", unit: "kg", quantity: 1 },
  { name: "Tomato",          kind: "fresh",  category: "vegetable", unit: "kg", quantity: 1 },
  { name: "Turmeric (haldi)", kind: "sundry", category: "spice" },
  { name: "Mustard seeds",   kind: "sundry", category: "spice" },
  { name: "Cumin (jeera)",   kind: "sundry", category: "spice" },
  { name: "Salt",            kind: "sundry", category: "spice" },
];

export const kindOf = (category: string): Kind =>
  CATEGORIES.find((c) => c.key === category)?.kind ?? "sundry";

export const categoryLabel = (key: string) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? "Other";

/** Days left before a fresh item should be used, or null when it doesn't apply. */
export function daysLeft(boughtOn: string | null, useWithin: number | null, today: string): number | null {
  if (!boughtOn || !useWithin) return null;
  const ms = new Date(`${boughtOn}T00:00:00Z`).getTime() + useWithin * 86400000
    - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

/** A staple is low when it drops under its own line; others carry a status. */
export function isLow(item: { kind: Kind; status: Status; quantity: number | null; low_when: number | null }) {
  if (item.status !== "ok") return true;
  if (item.kind === "staple" && item.quantity != null && item.low_when != null) {
    return item.quantity <= item.low_when;
  }
  return false;
}
