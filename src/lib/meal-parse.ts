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
