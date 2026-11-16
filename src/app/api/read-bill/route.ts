import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { logFault } from "@/lib/faults";
import { familyOf } from "@/lib/family";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, UNITS } from "@/lib/pantry";
import { lineAmount } from "@/lib/bill-flow";

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [string, ...string[]];
const UNIT_KEYS = UNITS as unknown as [string, ...string[]];

const Bill = z.object({
  kind: z.enum(["grocery", "eating_out"]),
  shop: z.string().nullable(),
  bill_date: z.string().nullable(),
  total: z.number().nullable(),
  items: z.array(z.object({
    name: z.string(),
    pack_size: z.number().nullable(),
    pack_unit: z.enum(["g", "kg", "ml", "l"]).nullable(),
    count: z.number().nullable(),
    unit: z.enum(UNIT_KEYS).nullable(),
    category: z.enum(CATEGORY_KEYS),
    is_food: z.boolean(),
    price: z.number().nullable(),
  })),
});

const SYSTEM = `You read a bill from an Indian shop and list what was bought, for a family's kitchen shelf and spending record.

First decide kind. "grocery" is a shop bill for things taken home: groceries, vegetables, milk, household goods. "eating_out" is a bill for food eaten or ordered ready to eat: a restaurant, café, hotel, canteen, sweet shop counter, or a delivery app such as Swiggy or Zomato.

For an eating_out bill: list each dish or drink as a line with its plain name, count as the number ordered with pack_size, pack_unit and unit null, category other, is_food false, and the line's price. If taxes, service charge, packing or delivery are printed as amounts, add one line named "Taxes and charges" with their printed sum, is_food false. Never invent an amount.

Bills are printed in shorthand: expand it into the plain name a family uses.
"TOOR DAL 1KG" → Toor dal, 1 kg. "AMUL TAAZA 500ML" → Milk, 500 ml. "SF REFIND SUNFL OIL 1L" → Sunflower oil, 1 l. "HALDI PWD 100G" → Turmeric (haldi), 100 g. Drop brand names unless the brand is how people say it (Maggi, Amul butter).

For each line give:
- name: the plain item name, title case, no brand or pack code
- The amount, as three printed facts. Report what is printed; never multiply or work anything out, the app does that.
  pack_size and pack_unit: the size printed in the item's own name or description ("TOOR DAL 500G" → 500, g; "MILK 1L" → 1, l; "BHINDI 225 G" → 225, g). null when the name carries no size.
  count: the number in the bill's quantity column for that line, exactly as printed, decimals included ("1.07" → 1.07; "2" → 2; "2 x 1KG" → count 2 with pack_size 1, kg). null when no quantity is printed.
  unit: what the count is counted in when the name carries no size: kg, g, l or ml for things sold loose by weight or volume ("TOMATO 1.070 KG" → count 1.07, unit kg), otherwise packet, piece, bunch or dozen ("1 PKT", "2 NOS" → packet). null when the name carries a size.
  A decimal count beside a pack size ("BHINDI 225 G   1.07") means that many times the pack: report pack_size 225, pack_unit g, count 1.07. Do not turn it into grams yourself.
  When the bill shows only a price and no amount, leave all four null. Never guess a weight.
- category: grain, dal, flour, oil, spice, vegetable, fruit, dairy, dry_fruit, ready, or other
  Fresh things are vegetable, even when they flavour food: ginger, garlic, green chilli, curry leaves, coriander leaves, mint, lemon is fruit.
  spice is only for dry spices: powders, seeds and whole dry spices (haldi, jeera, mustard seeds, dry red chilli, cardamom).
- is_food: false for soap, detergent, bags, and anything else that does not belong in a kitchen shelf
- price: what was charged for that line in rupees (the line's amount, not the rate per kg), as printed. null when no amount is shown for it. Never work out or guess a price.

Skip taxes, discounts, and anything you cannot read with confidence. At most 40 items, in the order they appear. Give the shop's name and the bill date (YYYY-MM-DD) when they are printed; otherwise null. total is the final amount payable printed on the bill, in rupees; null if not shown.`;

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

  // The shelf is the Key Member's to keep, so only they may fill it from a bill
  const { data: membership } = await supabase
    .from("kutumbh_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only the Key Member can add a bill to the shelf." }, { status: 403 });
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
    const money = (n: number | null) => (n != null && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null);
    // The reader reports what is printed; the amount is worked out here
    const clean = (i: (typeof parsed.items)[number]) => ({
      name: i.name.trim().slice(0, 60),
      ...lineAmount(i),
      category: i.category,
      price: money(i.price),
      is_food: parsed.kind === "eating_out" ? false : i.is_food,   // a meal eaten out never goes on the shelf
    });
    // Every line, for the spending record; the reader's output is only a first draft the Key Member checks
    const lines = parsed.items.filter((i) => i.name.trim()).slice(0, 40).map(clean);
    const items = parsed.items
      .filter((i) => i.is_food && parsed.kind !== "eating_out" && i.name.trim())
      .slice(0, 40)
      .map((i) => ({ name: i.name.trim().slice(0, 60), ...lineAmount(i), category: i.category }));

    return NextResponse.json({ kind: parsed.kind, shop: parsed.shop, bill_date: parsed.bill_date, total: money(parsed.total), items, lines });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The bill reader");
    await logFault(supabase, { where: "read-bill", error, status, kutumbhId, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }
}
