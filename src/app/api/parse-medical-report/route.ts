import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { familyOf } from "@/lib/family";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const LabReport = z.object({
  report_type: z.enum(["blood_test", "lipid_panel", "thyroid", "kidney", "liver", "cbc", "diabetes", "other"]),
  report_date: z.string(),
  values: z.array(z.object({
    key: z.string(),
    value: z.number(),
    reference_range: z.string(),
  })),
});

// Units must match the ones the Medical Reports card displays for each key.
const SYSTEM = `You read Indian medical lab reports (photos, scans or PDFs) and extract the numeric results.

Use these standard keys and convert each value into the unit shown, whatever unit the report uses:
hemoglobin g/dL · hba1c % · fasting_glucose mg/dL · postprandial_glucose mg/dL · total_cholesterol mg/dL · ldl mg/dL · hdl mg/dL · triglycerides mg/dL · iron μg/dL · ferritin ng/mL · vitamin_b12 pg/mL · vitamin_d ng/mL · tsh mIU/L · t3 ng/dL · t4 μg/dL · creatinine mg/dL · urea mg/dL · uric_acid mg/dL · alt U/L · ast U/L · alkaline_phosphatase U/L · bilirubin_total mg/dL · wbc ×10³/μL · rbc ×10⁶/μL · platelets ×10³/μL · sodium mEq/L · potassium mEq/L · calcium mg/dL

For any other numeric result, use a short snake_case key and keep the report's unit.

Rules:
- Only include results that are clearly printed as numbers; skip qualitative results (e.g. "Negative").
- reference_range: the printed normal range converted to the same unit (e.g. "13.0-17.0"), or "" if none is printed.
- report_date: the sample or report date as YYYY-MM-DD, or "" if it isn't visible.
- report_type: the best overall fit for the report.
- Never guess a value that isn't in the document. If the file isn't a lab report, return an empty values list.`;

function toKey(k: string) {
  return k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Report reading isn't configured on the server. Enter the values below." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  // Nothing is asked of the AI before we know the family can afford it
  const { kutumbhId } = await familyOf(supabase, user.id);
  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  let body: { fileBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The file couldn't be sent. Try again, or use a smaller file." }, { status: 400 });
  }

  const { fileBase64, mediaType } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.includes(mediaType as ImageType)) {
    return NextResponse.json({ error: "Please use a JPG or PNG photo, or a PDF." }, { status: 415 });
  }

  const fileBlock: Anthropic.Beta.BetaContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType as ImageType, data: fileBase64 } };

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(LabReport) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [fileBlock, { type: "text", text: "Extract the lab results from this report." }],
      }],
    });
    await recordSpend(supabase, {
      userId: user.id, kutumbhId, feature: "parse-medical-report", model: "claude-opus-5", usage: response.usage,
    });

    const report = response.parsed_output;
    if (response.stop_reason === "refusal" || !report) {
      return NextResponse.json({ error: "Couldn't read this report automatically. Enter the values below." }, { status: 422 });
    }

    const extracted_values: Record<string, number | string> = {};
    for (const v of report.values) {
      const key = toKey(v.key);
      if (!key || !Number.isFinite(v.value)) continue;
      extracted_values[key] = v.value;
      if (v.reference_range.trim()) extracted_values[`${key}_ref`] = v.reference_range.trim();
    }

    return NextResponse.json({
      report_type: report.report_type,
      report_date: /^\d{4}-\d{2}-\d{2}$/.test(report.report_date) ? report.report_date : null,
      extracted_values,
    });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The report reader");
    return NextResponse.json({ error: message }, { status });
  }
}
