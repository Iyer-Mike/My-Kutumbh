import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { logFault } from "@/lib/faults";
import { familyOf } from "@/lib/family";
import { FOOD_COLS, MAX_MEAL_TEXT } from "@/lib/meal-parse";

const MODEL = "claude-haiku-4-5-20251001";

const Parsed = z.object({
  items: z.array(z.object({
    phrase: z.string(),
    dish_id: z.string().nullable(),
    quantity: z.number(),
  })),
});

const SYSTEM = `You match a spoken or typed description of a meal to dishes in one family's own dish list, for a food-logging app.

The person may write in English, Hindi, Tamil, Telugu or Kannada, in native script or romanised, and may mix languages. Split the description into separate dishes. For each, give the short phrase as said, and the id of the best matching dish from the list, or null if nothing in the list is really the same dish. Never invent an id and never pick a loosely related dish: null is the right answer when unsure.

quantity is how many of that dish's own serving unit (shown in the list) the person had: "two idlis" is 2 when the unit is piece, "half a bowl" is 0.5 when the unit is bowl, "a plate" is 1. When no amount is said, use 1.

Report only what the person says they ate. Do not add dishes, sides or drinks they did not mention.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI isn't configured on the server" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { kutumbhId } = await familyOf(supabase, user.id);
  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const text = body.text?.trim().slice(0, MAX_MEAL_TEXT);
  if (!text) return NextResponse.json({ error: "Say or type what you ate" }, { status: 400 });

  // Only the dishes this person can already log (row-level security decides which)
  const { data: dishes } = await supabase.from("food_items").select(FOOD_COLS).order("name").limit(700);
  const list = dishes ?? [];
  if (!list.length) return NextResponse.json({ items: [] });
  const byId = new Map(list.map((d) => [String(d.id), d]));
  const catalogue = list.map((d) => `${d.id} | ${d.name}${d.name_ta ? ` (${d.name_ta})` : ""} | unit: ${d.serving_unit}`).join("\n");

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 1200,
      output_config: { format: betaZodOutputFormat(Parsed) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Dish list (id | name | serving unit):\n${catalogue}\n\nWhat the person said:\n${text}` }],
    });
    await recordSpend(supabase, { userId: user.id, kutumbhId, feature: "parse-meal", model: MODEL, usage: response.usage });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read that. Please try again." }, { status: 422 });
    }
    const items = response.parsed_output.items.slice(0, 12).map((i) => {
      const dish = i.dish_id ? byId.get(i.dish_id) : undefined;
      const qty = Math.min(20, Math.max(0.5, Math.round(i.quantity * 2) / 2 || 1));
      return { phrase: i.phrase.slice(0, 80), quantity: qty, food: dish ?? null };
    });
    return NextResponse.json({ items });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The meal reader");
    await logFault(supabase, { where: "parse-meal", error, status, kutumbhId, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }
}
