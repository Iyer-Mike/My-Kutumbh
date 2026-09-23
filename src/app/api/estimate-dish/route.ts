import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { CUISINES, DISH_TYPES } from "@/lib/food-taxonomy";

const DISH_TYPE_KEYS = DISH_TYPES.map((d) => d.key) as [string, ...string[]];
const CUISINE_KEYS = CUISINES.map((c) => c.key) as [string, ...string[]];

// Nutrient values are per 100 g of the dish as served.
const DishEstimate = z.object({
  category: z.enum(DISH_TYPE_KEYS),
  cuisine: z.enum(CUISINE_KEYS),
  diet: z.enum(["vegan", "veg", "egg", "nonveg"]),
  serving_unit: z.enum(["serving", "plate", "bowl", "katori", "piece", "cup", "glass", "tbsp", "tsp", "g"]),
  serving_weight_g: z.number(),
  per_100g: z.object({
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    fiber_g: z.number(),
    iron_mg: z.number(),
    calcium_mg: z.number(),
    vitamin_b12_mcg: z.number(),
    vitamin_c_mg: z.number(),
    folate_mcg: z.number(),
    sodium_mg: z.number(),
    potassium_mg: z.number(),
  }),
  rasa: z.array(z.enum(["sweet", "sour", "salty", "pungent", "bitter", "astringent"])),
  guna: z.array(z.enum(["heavy", "light", "oily", "dry", "smooth", "rough", "soft", "hard", "liquid", "dense"])),
  vipaka: z.enum(["sweet", "sour", "pungent"]),
  virya: z.enum(["heating", "cooling", "neutral"]),
  vata_effect: z.enum(["balances", "neutral", "aggravates"]),
  pitta_effect: z.enum(["balances", "neutral", "aggravates"]),
  kapha_effect: z.enum(["balances", "neutral", "aggravates"]),
  note: z.string(),
});

export type DishEstimateResult = z.infer<typeof DishEstimate>;

const SYSTEM = `You estimate nutrition and Ayurvedic properties for home-cooked Indian dishes, for a family food-tracking app.

Base nutrient figures on Indian Food Composition Tables (IFCT 2017) and standard references, reasoning from the listed ingredients and preparation method. Report every nutrient per 100 g of the dish as served (cooked, with its water). Include typical home salt in sodium unless the preparation says otherwise; account for oil or ghee in the method.

Choose the serving unit and weight a household would naturally use for this dish (e.g. sambar: bowl ≈ 150 g; idli: piece ≈ 40 g; rice: cup ≈ 150 g).

Classify the dish: category is its dish type (${DISH_TYPES.map((d) => `${d.key} = ${d.hint}`).join("; ")}). cuisine is its regional cuisine (${CUISINES.map((c) => `${c.key}: ${c.examples}`).join("; ")}). diet is the strictest diet it fits from the ingredients: vegan (no animal products), veg (dairy allowed), egg, or nonveg (meat, fish, seafood).

For Ayurvedic properties use classical texts: rasa (tastes present, most dominant first), guna (qualities), vipaka, virya, and the dish's effect on each dosha.

In "note", give one short sentence on the main assumption behind the estimate (for example, the oil quantity or dal-to-water ratio assumed). These are estimates for trend tracking, not clinical values.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI estimation isn't configured on the server" }, { status: 503 });
  }

  // Only a Prime Member completes Family Dishes, so only they may call this
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only the Prime Member can estimate dishes" }, { status: 403 });
  }

  let body: { name?: string; ingredients?: string; preparation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Dish name is required" }, { status: 400 });
  const ingredients = body.ingredients?.trim().slice(0, 1500) || "not specified";
  const preparation = body.preparation?.trim().slice(0, 1500) || "not specified";

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(DishEstimate) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Dish: ${name}\nIngredients: ${ingredients}\nPreparation: ${preparation}`,
      }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't estimate this dish. Please enter the values manually." }, { status: 422 });
    }

    return NextResponse.json(response.parsed_output);
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The dish estimator");
    return NextResponse.json({ error: message }, { status });
  }
}
