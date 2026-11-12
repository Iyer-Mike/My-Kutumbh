/** Typed and spoken meal logging: shared names and limits. */

/** Same columns the Log page reads for a dish. */
export const FOOD_COLS =
  "id,name,name_ta,category,cuisine,diet,meal_hint,recipe_id,calories,protein_g,serving_unit,serving_weight_g,ingredients,preparation,needs_review,kutumbh_id";

/** Voice languages offered: English first (the default), then the four agreed. */
export const VOICE_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
] as const;

export const MAX_MEAL_TEXT = 400;

/** What the matcher says about one phrase of the meal. */
export type ParsedItem = {
  phrase: string;
  /** food_items id from the family's list, or null when nothing in it fits. */
  dish_id: string | null;
  /** How many of the dish's own serving unit (1 = one serving, 0.5 = half). */
  quantity: number;
};

// ── Shared by the text and the photo matchers (server side) ──────────

import type { SupabaseClient } from "@supabase/supabase-js";

/** The dishes this person can log (row-level security decides which), as rows and as a prompt list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCatalogue(supabase: SupabaseClient<any, any, any>) {
  const { data } = await supabase.from("food_items").select(FOOD_COLS).order("name").limit(700);
  const list = (data ?? []) as Array<Record<string, unknown> & { id: string; name: string; name_ta: string | null; serving_unit: string }>;
  return {
    list,
    byId: new Map(list.map((d) => [String(d.id), d])),
    text: list.map((d) => `${d.id} | ${d.name}${d.name_ta ? ` (${d.name_ta})` : ""} | unit: ${d.serving_unit}`).join("\n"),
  };
}

/** Matcher output to what the page gets: known dishes only, sensible amounts, at most 12 lines. */
export function finishItems(
  items: ParsedItem[],
  byId: Map<string, Record<string, unknown>>,
) {
  return items.slice(0, 12).map((i) => {
    const dish = i.dish_id ? byId.get(i.dish_id) : undefined;
    const qty = Math.min(20, Math.max(0.5, Math.round(i.quantity * 2) / 2 || 1));
    return { phrase: i.phrase.slice(0, 80), quantity: qty, food: dish ?? null };
  });
}
