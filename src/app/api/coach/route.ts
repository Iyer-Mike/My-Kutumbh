import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "@/lib/ai-error";
import { createClient } from "@/lib/supabase/server";
import { daysAgoLocal } from "@/lib/dates";
import { loadInsightsData } from "@/lib/insights/load";
import { computeNeeds, ageOn } from "@/lib/insights/needs";
import { summarizeIntake } from "@/lib/insights/intake";
import { summarizeAyurveda } from "@/lib/insights/ayurveda";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import { evaluateIntelligence } from "@/lib/insights/intelligence";
import { ayurvedaNarrative, energyNarrative, microNarrative } from "@/lib/insights/narrate";

const SYSTEM = `You are the My Kutumbh health coach: a warm, practical guide to food and everyday habits for an Indian family, grounded in modern nutrition and Ayurveda.

You are given one family member's profile, their last 7 days of logged meals, their latest lab findings and the app's alerts. Use those facts; if something needed isn't in the data, say so rather than guessing.

How to answer:
- Be concise: usually 3–6 short sentences or a short bulleted list. Plain, friendly language; no jargon.
- Suggest real Indian home foods, preferring the family's own dishes listed in the data. Respect their diet type strictly (e.g. never suggest meat or egg to a vegetarian) and never suggest anything matching their allergies.
- Tie advice to their numbers where it helps ("your fibre is 42% of need, so…").
- Ayurveda: you may note what suits their Prakriti, as a complement to — never a replacement for — medical advice.

Safety rules — always follow:
- You are not a doctor. Never diagnose, and never tell anyone to start, stop or change the dose of a medicine or supplement; say "ask your doctor" instead.
- If they mention chest pain, breathlessness, fainting, severe pain, very high or very low sugar symptoms, blood in stool or vomit, or thoughts of self-harm, tell them to seek medical care urgently before anything else.
- Stay on food, nutrition, lab results, Ayurveda and daily habits. Politely decline unrelated requests.`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The coach isn't configured on the server yet." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let body: { messages?: Msg[]; member?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Ask a question to start." }, { status: 400 });
  }
  if (messages[0].role !== "user") messages.shift();

  // Same data and rules as the Insights tab (member sees own; Prime sees any)
  const d = await loadInsightsData(supabase, user.id, body.member);
  const needs = computeNeeds(d.profile, d.today);
  const from7 = daysAgoLocal(6);
  const week = d.entries.filter((e) => e.logged_date >= from7);
  const intake = summarizeIntake(d.entries, from7, d.today);
  const labs = latestLabValues(d.reports);
  const flags = evaluateLabs(labs, { intake, needs, foods: d.foods, allergies: d.profile.allergies ?? [] });
  const events = evaluateIntelligence({ profile: d.profile, needs, intake, entries: week, labs });
  const ayurveda = summarizeAyurveda(week, d.profile.primary_dosha);

  const counts = new Map<string, number>();
  for (const e of week) counts.set(e.food_name, (counts.get(e.food_name) ?? 0) + 1);
  const topFoods = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => `${n} ×${c}`);

  const p = d.profile;
  const context = [
    `MEMBER: ${d.name.split(" ")[0]}${d.viewingOther ? " (the Prime Member is asking on their behalf)" : ""}`,
    `Age ${ageOn(p.date_of_birth, d.today) ?? "unknown"}, ${p.gender ?? "sex not given"}, ${p.height_cm ?? "?"} cm, ${p.weight_kg ?? "?"} kg, activity ${p.activity_level ?? "unknown"}`,
    `Diet: ${p.diet_type ?? "not given"} · Prakriti: ${p.primary_dosha ?? "not assessed"}`,
    `Conditions: ${(p.conditions ?? []).join(", ") || "none listed"}`,
    `Allergies/intolerances: ${(p.allergies ?? []).join(", ") || "none listed"}`,
    `Medications: ${(p.medications ?? []).join(", ") || "none listed"}`,
    "",
    `DAILY TARGETS: ${needs.kcal.value} kcal (${needs.kcal.source}), protein ${needs.protein_g.value} g, fibre ${needs.fiber_g.value} g, sodium limit ${needs.sodium_mg.value} mg`,
    `LAST 7 DAYS (${intake.loggedDays} days logged, ${intake.items} items): ${energyNarrative(intake, needs)} ${microNarrative(intake, needs)}`,
    `Averages per logged day: protein ${Math.round(intake.perDay.protein_g)} g, carbs ${Math.round(intake.perDay.carbs_g)} g, fat ${Math.round(intake.perDay.fat_g)} g, fibre ${Math.round(intake.perDay.fiber_g)} g, sodium ${Math.round(intake.perDay.sodium_mg)} mg`,
    `Most logged: ${topFoods.join(", ") || "nothing logged"}`,
    `Ayurveda: ${ayurvedaNarrative(ayurveda)}`,
    "",
    `LATEST LAB REPORT: ${d.reports[0]?.report_date ?? "none uploaded"}`,
    ...flags.map((f) => `- ${f.label}: ${f.readings.map((r) => `${r.label} ${r.value}${r.unit ? " " + r.unit : ""} (${r.status}, normal ${r.range})`).join("; ")}`),
    "",
    "APP ALERTS:",
    ...(events.length ? events.map((e) => `- [${e.severity}] ${e.title}: ${e.detail}`) : ["- none"]),
    "",
    `FAMILY'S OWN DISHES: ${d.familyDishNames.join(", ") || "none added yet"}`,
    `FOOD LIST (catalogue): ${[...new Set(d.foods.map((f) => f.name))].slice(0, 120).join(", ")}`,
  ].join("\n");

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: `${SYSTEM}\n\n<member_data>\n${context}\n</member_data>`,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ reply: "I can't help with that one. Please ask me about food, nutrition, your lab results or daily habits." });
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ reply: reply || "Sorry, I couldn't put an answer together. Please try asking another way." });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The coach");
    return NextResponse.json({ error: message }, { status });
  }
}
