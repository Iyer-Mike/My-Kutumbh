import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: { fileBase64: string; mediaType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fileBase64, mediaType } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json({ error: "Missing fileBase64 or mediaType" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: fileBase64,
            },
          },
          {
            type: "text",
            text: `You are a medical lab report parser.

Look at this medical report image. Extract all available lab values.

Also infer:
- report_type: one of 'blood_test', 'lipid_panel', 'thyroid', 'kidney', 'liver', 'cbc', 'diabetes', 'other'
- report_date: date in YYYY-MM-DD format if visible, else null

For the extracted values, use these standard keys where applicable (all values as numbers, units stripped):
hemoglobin, hba1c, fasting_glucose, postprandial_glucose, total_cholesterol, ldl, hdl, triglycerides,
iron, ferritin, tibc, vitamin_b12, vitamin_d, tsh, t3, t4,
creatinine, urea, uric_acid, alt, ast, alkaline_phosphatase, bilirubin_total,
wbc, rbc, platelets, mcv, mch, mchc, neutrophils, lymphocytes,
sodium, potassium, calcium, phosphorus

For any values not in the above list, add them with a snake_case key.
Include reference range as a separate key with suffix _ref (e.g. "hemoglobin_ref": "12.0-16.0") if visible.

Return ONLY a JSON object — no explanation, no markdown, no extra text.

Example:
{
  "report_type": "blood_test",
  "report_date": "2026-09-10",
  "hemoglobin": 12.4,
  "hemoglobin_ref": "12.0-16.0",
  "hba1c": 6.1,
  "hba1c_ref": "4.0-5.6",
  "iron": 58,
  "vitamin_b12": 210,
  "vitamin_d": 28
}`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
  const match = text.match(/\{[\s\S]*\}/);

  type ParsedReport = {
    report_type?: string;
    report_date?: string | null;
    [key: string]: unknown;
  };

  let parsed: ParsedReport = { report_type: "other", report_date: null };

  if (match) {
    try {
      const raw = JSON.parse(match[0]);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        parsed = raw as ParsedReport;
      }
    } catch {
      // Return empty result — user can enter manually
    }
  }

  const { report_type, report_date, ...extracted_values } = parsed;

  return NextResponse.json({
    report_type:      report_type ?? "other",
    report_date:      report_date ?? null,
    extracted_values: extracted_values,
  });
}
