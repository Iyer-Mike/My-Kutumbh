import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { logFault } from "@/lib/faults";
import { familyOf } from "@/lib/family";
import { finishItems, loadCatalogue } from "@/lib/meal-parse";

const MODEL = "claude-haiku-4-5-20251001";
// A resized phone photo is well under this; anything larger is not a plate photo
const MAX_BASE64 = 4_000_000;

const Parsed = z.object({
  items: z.array(z.object({
    phrase: z.string(),
    dish_id: z.string().nullable(),
    quantity: z.number(),
  })),
});

const SYSTEM = `You look at a photo of a plate or table of food and match what you can see to dishes in one family's own dish list, for a food-logging app.

For each distinct dish you can see, give a short phrase for what it looks like, and the id of the best matching dish from the list, or null if nothing in the list is really the same dish. Never invent an id and never pick a loosely related dish: null is the right answer when unsure. Do not list garnish, cutlery or things that are not food.

quantity is how many of that dish's own serving unit (shown in the list) the plate holds: three idlis is 3 when the unit is piece, a small bowl of sambar is 1 when the unit is bowl, half a katori is 0.5. When unsure of the amount, use 1.

If the photo does not show food, return no items.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI isn't configured on the server" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { kutumbhId } = await familyOf(supabase, user.id);
  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  let body: { imageBase64?: string; mediaType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) return NextResponse.json({ error: "No photo received" }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "Use a JPEG or PNG photo." }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });

  const cat = await loadCatalogue(supabase);
  if (!cat.list.length) return NextResponse.json({ items: [] });

  const client = new Anthropic({ apiKey });
  try {
    // The photo lives only in this request: it is sent to the model and not stored anywhere
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 1200,
      output_config: { format: betaZodOutputFormat(Parsed) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 } },
          { type: "text", text: `Dish list (id | name | serving unit):\n${cat.text}\n\nMatch what is on the plate.` },
        ],
      }],
    });
    await recordSpend(supabase, { userId: user.id, kutumbhId, feature: "match-plate", model: MODEL, usage: response.usage });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read that photo. Please try again." }, { status: 422 });
    }
    return NextResponse.json({ items: finishItems(response.parsed_output.items, cat.byId) });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The plate reader");
    await logFault(supabase, { where: "match-plate", error, status, kutumbhId, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }
}
