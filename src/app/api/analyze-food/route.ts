import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { familyOf } from "@/lib/family";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const UNITS = ["piece", "serving", "plate", "bowl", "katori", "cup", "glass", "tbsp", "tsp", "g"] as const;

const PhotoItems = z.object({
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.enum(UNITS),
    calories: z.number(),
  })),
});

const SYSTEM = `You identify Indian home food in a photo of a plate or table, for a family food log.

Name each dish the way a family would say it (1–4 words, title case): Idli, Medu Vada, Coconut Chutney, Rajma, Curd Rice. Use the regional name when the dish is clearly regional.

For each dish give the quantity visible, its natural unit (2 idli = 2 piece; sambar = 1 bowl; chutney = 2 tbsp; rice = 1 cup) and the calories for that quantity, using Indian Food Composition Tables and normal home cooking, including the oil or ghee you can see.

List up to 6 dishes, the most prominent first. Include only food and drink you can actually see; if the photo has no food, return an empty list.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Photo analysis isn't configured on the server yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  // Nothing is asked of the AI before we know the family can afford it
  const { kutumbhId } = await familyOf(supabase, user.id);
  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "No photo received. Please try again." }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "That image type isn't supported. Use a JPEG or PNG photo." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.parse({
      // Haiku reads a plate of food well and costs a fraction of Opus
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      output_config: { format: betaZodOutputFormat(PhotoItems) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
          },
          { type: "text", text: "What food is on this plate, and roughly how much?" },
        ],
      }],
    });
    await recordSpend(supabase, {
      userId: user.id, kutumbhId, feature: "analyze-food", model: "claude-haiku-4-5-20251001", usage: response.usage,
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read that photo. Please add the dishes by hand." }, { status: 422 });
    }

    const items = response.parsed_output.items.slice(0, 6).map((i) => ({
      name: i.name.trim().slice(0, 60) || "Unknown",
      quantity: i.quantity > 0 ? Math.round(i.quantity * 2) / 2 : 1,
      unit: i.unit,
      calories: Math.max(0, Math.round(i.calories)),
    }));
    return NextResponse.json({ items });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The photo reader");
    return NextResponse.json({ error: message }, { status });
  }
}
