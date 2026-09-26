import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { familyOf } from "@/lib/family";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, UNITS } from "@/lib/pantry";

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [string, ...string[]];
const UNIT_KEYS = UNITS as unknown as [string, ...string[]];

const Bill = z.object({
  shop: z.string().nullable(),
  bill_date: z.string().nullable(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.enum(UNIT_KEYS).nullable(),
    category: z.enum(CATEGORY_KEYS),
    is_food: z.boolean(),
  })),
});

const SYSTEM = `You read a grocery bill from an Indian shop and list what was bought, for a family's kitchen shelf.

Bills are printed in shorthand: expand it into the plain name a family uses.
"TOOR DAL 1KG" → Toor dal, 1 kg. "AMUL TAAZA 500ML" → Milk, 500 ml. "SF REFIND SUNFL OIL 1L" → Sunflower oil, 1 l. "HALDI PWD 100G" → Turmeric (haldi), 100 g. Drop brand names unless the brand is how people say it (Maggi, Amul butter).

For each line give:
- name: the plain item name, title case, no brand or pack code
- quantity and unit: the amount bought, in kg, g, l, ml, packet, piece, bunch or dozen. A line like "2 x 1KG" is 2 kg. When the bill shows only a price and no amount, leave both null.
- category: grain, dal, flour, oil, spice, vegetable, fruit, dairy, dry_fruit, ready, or other
- is_food: false for soap, detergent, bags, and anything else that does not belong in a kitchen shelf

Skip totals, taxes, discounts, and anything you cannot read with confidence. At most 40 items, in the order they appear. Give the shop's name and the bill date (YYYY-MM-DD) when they are printed; otherwise null.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Bill reading isn't configured on the server yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  // Nothing is asked of the AI before we know the family can afford it
  const { kutumbhId } = await familyOf(supabase, user.id);
  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  // The shelf is the Prime Member's to keep, so only they may fill it from a bill
  const { data: membership } = await supabase
    .from("kutumbh_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only the Prime Member can add a bill to the shelf." }, { status: 403 });
  }

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
  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "Use a photo of the bill, or a PDF." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.parse({
      // Haiku reads a printed bill well and costs a fraction of Opus
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      output_config: { format: betaZodOutputFormat(Bill) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          isPdf
            ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: imageBase64 } }
            : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg", data: imageBase64 } },
          { type: "text" as const, text: "What was bought on this bill?" },
        ],
      }],
    });
    await recordSpend(supabase, {
      userId: user.id, kutumbhId, feature: "read-bill", model: "claude-haiku-4-5-20251001", usage: response.usage,
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read that bill. Add the items by hand." }, { status: 422 });
    }

    const parsed = response.parsed_output;
    const items = parsed.items
      .filter((i) => i.is_food && i.name.trim())
      .slice(0, 40)
      .map((i) => ({
        name: i.name.trim().slice(0, 60),
        quantity: i.quantity != null && i.quantity > 0 ? Math.round(i.quantity * 100) / 100 : null,
        unit: i.unit,
        category: i.category,
      }));

    return NextResponse.json({ shop: parsed.shop, bill_date: parsed.bill_date, items });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The bill reader");
    return NextResponse.json({ error: message }, { status });
  }
}
