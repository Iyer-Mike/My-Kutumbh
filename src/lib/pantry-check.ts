import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_BY_KEY, convert, estimate, menuUse, type Estimate, type MenuDish, type MenuUse } from "./kitchen-library.ts";
import type { Unit } from "./pantry.ts";

/** How far back the menu is read: a shelf item last counted earlier than this simply loses the older dishes. */
const MENU_DAYS = 45;

export const ITEM_COLS =
  "id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note, library_key, stock_at, daily_use";

/** The calendar day of a moment, in the family's own zone. */
export function dayIn(ts: string | null, timeZone: string): string | null {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

export type CheckedItem = {
  id: string; name: string; kind: string; category: string; quantity: number | null; unit: Unit | null;
  low_when: number | null; status: string; bought_on: string | null; use_within_days: number | null;
  library_key: string | null; stock_at: string | null; daily_use: number | null;
};

export type PantryCheck = {
  familySize: number;
  use: MenuUse;
  estimates: Record<string, Estimate>;
  short: { id: string; name: string; reason: Estimate["reason"]; est: number | null; unit: Unit | null }[];
};

/**
 * Read the menu the kitchen has cooked, estimate every shelf item, and keep the shopping list
 * in step: anything short goes on it by itself; anything that is no longer short and was put
 * there by the app comes off again.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkPantry(supabase: SupabaseClient<any, any, any>, opts: {
  kutumbhId: string; userId: string; timeZone: string; today: string; items: CheckedItem[]; sync: boolean;
}): Promise<PantryCheck> {
  const { kutumbhId, userId, timeZone, today, items } = opts;

  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - MENU_DAYS);
  const [{ count }, { data: plans }] = await Promise.all([
    supabase.from("kutumbh_members").select("user_id", { count: "exact", head: true }).eq("kutumbh_id", kutumbhId),
    supabase.from("meal_plans").select("planned_date, food_items(recipe_id)")
      .eq("kutumbh_id", kutumbhId).gte("planned_date", since.toISOString().slice(0, 10)).lte("planned_date", today).limit(2000),
  ]);
  const familySize = Math.max(count ?? 1, 1);

  const recipeIds = [...new Set((plans ?? [])
    .map((p) => (p.food_items as unknown as { recipe_id: number | null } | null)?.recipe_id)
    .filter((id): id is number => id != null))];
  const recipes = new Map<number, { serves: string | null; ingredients: string[] }>();
  if (recipeIds.length) {
    const { data } = await supabase.from("recipes").select("id, serves, ingredients").in("id", recipeIds);
    for (const r of data ?? []) recipes.set(r.id as number, { serves: r.serves, ingredients: r.ingredients ?? [] });
  }
  const dishes: MenuDish[] = [];
  for (const p of plans ?? []) {
    const rid = (p.food_items as unknown as { recipe_id: number | null } | null)?.recipe_id;
    const r = rid != null ? recipes.get(rid) : undefined;
    if (r) dishes.push({ date: p.planned_date as string, serves: r.serves, ingredients: r.ingredients });
  }
  const use = menuUse(dishes, familySize);

  const estimates: Record<string, Estimate> = {};
  const short: PantryCheck["short"] = [];
  for (const it of items) {
    const e = estimate(it, use, familySize, today, dayIn(it.stock_at, timeZone));
    estimates[it.id] = e;
    if (e.short) short.push({ id: it.id, name: it.name, reason: e.reason, est: e.est, unit: it.unit });
  }

  if (opts.sync) await syncList(supabase, { kutumbhId, userId, items, short });
  return { familySize, use, estimates, short };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncList(supabase: SupabaseClient<any, any, any>, o: {
  kutumbhId: string; userId: string; items: CheckedItem[]; short: PantryCheck["short"];
}) {
  const { data: open } = await supabase.from("shopping_items")
    .select("id, pantry_item_id, source").eq("kutumbh_id", o.kutumbhId).eq("status", "open");
  const listed = new Set((open ?? []).map((s) => s.pantry_item_id).filter(Boolean));
  const shortIds = new Set(o.short.map((s) => s.id));

  const add = o.short.filter((s) => !listed.has(s.id)).map((s) => {
    const it = o.items.find((i) => i.id === s.id)!;
    const lib = it.library_key ? LIBRARY_BY_KEY.get(it.library_key) : undefined;
    const usual = lib ? convert(lib.pack, lib.unit, it.unit ?? lib.unit) : null;
    return {
      kutumbh_id: o.kutumbhId, name: it.name, source: "auto", pantry_item_id: it.id, requested_by: o.userId,
      unit: it.unit ?? lib?.unit ?? null, quantity: usual != null ? Math.round(usual * 1000) / 1000 : null,
    };
  });
  if (add.length) await supabase.from("shopping_items").insert(add);

  // The app's own suggestions that no longer apply (someone said there is plenty) come off
  const stale = (open ?? []).filter((s) => s.source === "auto" && s.pantry_item_id && !shortIds.has(s.pantry_item_id));
  if (stale.length) await supabase.from("shopping_items").delete().in("id", stale.map((s) => s.id));
}
