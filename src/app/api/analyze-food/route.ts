import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: { imageBase64: string; mediaType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Missing imageBase64 or mediaType" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `You are a South Indian food recognition and nutrition assistant.

Look at this food photo. Identify every dish or food item visible.

For each item, estimate:
- The food name (1–4 words, title-cased)
- The typical serving quantity visible in the photo
- The most natural unit (piece, serving, cup, bowl, glass, tbsp, g)
- The approximate calories for that quantity

Return ONLY a JSON array of objects — no explanation, no markdown, no extra text.
List up to 6 items, most prominent first.

Example output:
[
  {"name":"Idli","quantity":2,"unit":"piece","calories":160},
  {"name":"Coconut Chutney","quantity":2,"unit":"tbsp","calories":60},
  {"name":"Sambar","quantity":1,"unit":"cup","calories":120}
]`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  const match = text.match(/\[[\s\S]*\]/);

  type AiItem = { name: string; quantity: number; unit: string; calories: number | null };
  let items: AiItem[] = [];

  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        items = parsed.map((i: Partial<AiItem>) => ({
          name:     typeof i.name     === "string" ? i.name.trim()  : "Unknown",
          quantity: typeof i.quantity === "number" ? i.quantity      : 1,
          unit:     typeof i.unit     === "string" ? i.unit.trim()   : "serving",
          calories: typeof i.calories === "number" ? Math.round(i.calories) : null,
        }));
      }
    } catch {
      items = [];
    }
  }

  return NextResponse.json({ items });
}
