import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { logFault } from "@/lib/faults";
import { familyOf } from "@/lib/family";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const UNITS = ["piece", "serving", "plate", "bowl", "katori", "cup", "glass", "tbsp", "tsp"] as const;

const Estimates = z.object({
  recipes: z.array(z.object({
    id: z.number(),
    serving_unit: z.enum(UNITS),
    serving_weight_g: z.number(),
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    fibre_g: z.number(),
    iron_mg: z.number(),
    calcium_mg: z.number(),
    vit_b12_mcg: z.number(),
    sodium_mg: z.number(),
  })),
});

const SYSTEM = `You estimate the nutrition of Indian home-cooked dishes for a family food log.

For each recipe you are given its name, the amounts it serves, the ingredients and the method. Work out ONE serving as a family would eat it, name the natural unit (idli = piece; sambar, curry, dal = bowl; rice = cup), and give that serving's weight in grams and its nutrition: energy in kcal, protein, carbohydrate, fat and fibre in grams, iron, calcium and sodium in milligrams, vitamin B12 in micrograms.

Use the Indian Food Composition Tables (IFCT) values for the ingredients, account for the oil, ghee, coconut or sugar in the ingredient list, and divide by the number served when that is given. If the amounts are missing, assume a typical home portion and stay conservative. These are estimates; do not round to fake precision. Return every recipe id you were given, once.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Estimates aren't configured on the server yet." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  // Only the Key Member asks for estimates
  const { kutumbhId, isPrime } = await familyOf(supabase, user.id);
  if (!kutumbhId || !isPrime) return NextResponse.json({ error: "Only the Key Member can ask for estimates." }, { status: 403 });

  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  let body: { recipeIds?: number[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const ids = (body.recipeIds ?? []).filter((n) => Number.isInteger(n)).slice(0, 10);
  if (!ids.length) return NextResponse.json({ error: "Pick at least one recipe." }, { status: 400 });

  // Read through the signed-in client, so only this family's bucket can be reached
  const { data: rows } = await supabase
    .from("recipes")
    .select("id, name, serves, ingredients, method")
    .in("id", ids)
    .eq("kutumbh_id", kutumbhId)
    .eq("in_bucket", true);
  if (!rows?.length) return NextResponse.json({ error: "Those recipes are not in the bucket." }, { status: 404 });

  const prompt = rows.map((r) =>
    `ID ${r.id}: ${r.name}\nServes: ${r.serves ?? "not stated"}\nIngredients:\n- ${(r.ingredients ?? []).join("\n- ")}\nMethod:\n${(r.method ?? []).map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}`
  ).join("\n\n---\n\n");

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      output_config: { format: betaZodOutputFormat(Estimates) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    await recordSpend(supabase, {
      userId: user.id, kutumbhId, feature: "estimate-nutrition", model: "claude-haiku-4-5-20251001", usage: response.usage,
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't estimate these. Please try again." }, { status: 422 });
    }
    const allowed = new Set(rows.map((r) => r.id));
    const n = (v: number, d = 0) => Math.max(0, Math.round(v * 10 ** d) / 10 ** d);
    const estimates = response.parsed_output.recipes.filter((e) => allowed.has(e.id)).map((e) => ({
      id: e.id, serving_unit: e.serving_unit,
      serving_weight_g: Math.min(2000, Math.max(1, Math.round(e.serving_weight_g))),
      kcal: n(e.kcal), protein_g: n(e.protein_g, 1), carbs_g: n(e.carbs_g, 1), fat_g: n(e.fat_g, 1),
      fibre_g: n(e.fibre_g, 1), iron_mg: n(e.iron_mg, 1), calcium_mg: n(e.calcium_mg), vit_b12_mcg: n(e.vit_b12_mcg, 2), sodium_mg: n(e.sodium_mg),
    }));
    return NextResponse.json({ estimates });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The estimator");
    await logFault(supabase, { where: "estimate-nutrition", error, status, kutumbhId, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }
}
