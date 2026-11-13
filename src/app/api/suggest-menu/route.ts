import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkBudget, recordSpend } from "@/lib/ai-budget";
import { logFault } from "@/lib/faults";
import { familyOf } from "@/lib/family";
import { todayLocal } from "@/lib/dates";
import { BUILT_IN_FESTIVALS } from "@/lib/festivals";
import { computeNeeds } from "@/lib/insights/needs";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import type { Profile } from "@/lib/insights/types";
import {
  SUGGEST_COLS, SUGGEST_SLOTS, cleanProposal, eligibleDishes, perServing, strictestDiet, weeklyAverages, windowDates,
  type SuggestDish,
} from "@/lib/menu-suggest";

const MODEL = "claude-opus-5";

const Proposal = z.object({
  summary: z.string(),
  slots: z.array(z.object({
    date: z.string(),
    slot: z.string(),
    dish_ids: z.array(z.string()),
    why: z.string(),
  })),
});

const SYSTEM = `You plan a week of family meals for an Indian household, for a food-and-health app.

You are given the dishes the family may use (already cut down to the Key Member's diet and free of every member's allergens), the slots still empty, and a short profile. Choose dishes only from the list, by id. Never invent an id.

How to plan:
- Fit each dish to its meal using the hint. Give each meal one to three dishes that go together as a real Indian meal (for example a staple with a dal and a side), not a list of unrelated items.
- Vary the week. Do not repeat the same dish more than twice in the seven days.
- Aim for each person's day to come near their kcal and protein figures; the app checks the averages afterwards, so favour balance over exactness.
- Follow the Key Member's dosha and conditions where they are given, and the dietary needs listed, which come from family members' medical reports (favour what they say to favour, go easy on what they say to limit).
- One menu serves everyone eating together. Choose it on nutrition: the whole family's meals across the week should come near each person's kcal and protein figures. Do not plan around what is in the kitchen; the shopping list is worked out from the menu afterwards.
- If a festival falls in the week, prefer a dish that fits it on that day.
- Fill only the slots listed. Give one short plain reason per slot (under 20 words) that a family can read. Never mention a person's lab readings or conditions in a reason; speak of the food ("fibre-rich, light on sugar").
- summary: two sentences on how the week is planned.`;

type ProfileRow = Profile & { full_name: string | null };

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI isn't configured on the server" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { kutumbhId, isPrime, timeZone } = await familyOf(supabase, user.id);
  if (!kutumbhId || !isPrime) return NextResponse.json({ error: "Only the Key Member can plan the menu" }, { status: 403 });

  const budget = await checkBudget(supabase, user.id, kutumbhId);
  if (!budget.ok) return NextResponse.json({ error: budget.message }, { status: budget.status });

  try {
    const today = todayLocal(timeZone);
    const window = windowDates(today, 7);

    const { data: mem } = await supabase.from("kutumbh_members").select("user_id").eq("kutumbh_id", kutumbhId);
    const ids = (mem ?? []).map((m) => m.user_id as string);

    const [{ data: profs }, { data: records }, { data: planned }, { data: dishRows }] = await Promise.all([
      supabase.from("profiles")
        .select("id, full_name, date_of_birth, gender, height_cm, weight_kg, activity_level, daily_kcal_goal, primary_dosha, diet_type, allergies, conditions, medications")
        .in("id", ids),
      supabase.from("medical_records").select("user_id, report_date, extracted_values").in("user_id", ids),
      supabase.from("meal_plans").select("planned_date, meal_slot, food_item_id")
        .eq("kutumbh_id", kutumbhId).gte("planned_date", window[0]).lte("planned_date", window[6]),
      supabase.from("food_items").select(SUGGEST_COLS).order("name").limit(700),
    ]);

    const profiles = (profs ?? []) as unknown as (ProfileRow & { id: string })[];
    const key = profiles.find((p) => p.id === user.id);
    const allAllergies = profiles.flatMap((p) => p.allergies ?? []);

    // Hard limits first, in code
    const all = (dishRows ?? []) as SuggestDish[];
    // A dish must suit every member, so the strictest diet in the family decides
    const diets = profiles.map((p) => p.diet_type ?? null);
    const allowed = eligibleDishes(all, diets, allAllergies);
    if (allowed.length < 12) {
      return NextResponse.json({ error: "There aren't enough dishes yet that suit everyone's diet and allergies. Add a few family dishes, then try again." }, { status: 422 });
    }
    const prompt = [...allowed]
      .sort((a, b) => Number(!!b.kutumbh_id) - Number(!!a.kutumbh_id))
      .slice(0, 450);
    const allowedMap = new Map(allowed.map((d) => [d.id, d]));

    // Slots already planned stay as they are
    const filled = new Set((planned ?? []).map((p) => `${p.planned_date}|${p.meal_slot}`));
    const open: string[] = [];
    for (const date of window) for (const slot of SUGGEST_SLOTS) if (!filled.has(`${date}|${slot}`)) open.push(`${date} ${slot}`);
    if (!open.length) return NextResponse.json({ error: "Every meal this week is already planned." }, { status: 422 });

    // Dietary needs from medical reports, only for members who have one
    const needLabels = new Map<string, { favour: Set<string>; limit: Set<string> }>();
    for (const p of profiles) {
      const recs = (records ?? []).filter((r) => r.user_id === p.id);
      if (!recs.length) continue;
      const flags = evaluateLabs(latestLabValues(recs), { intake: null, needs: null, foods: [], allergies: p.allergies ?? [] })
        .filter((f) => f.known);
      for (const f of flags) {
        const e = needLabels.get(f.label) ?? { favour: new Set<string>(), limit: new Set<string>() };
        f.favour.slice(0, 2).forEach((x) => e.favour.add(x));
        f.limit.slice(0, 2).forEach((x) => e.limit.add(x));
        needLabels.set(f.label, e);
      }
    }
    const needs = [...needLabels.entries()].map(([label, v]) => ({ label, favour: [...v.favour], limit: [...v.limit] }));

    // Good Range per member (profile-based), used for the prompt and the averages
    const targets = profiles.map((p) => {
      const n = computeNeeds(p, today);
      return { id: p.id, name: (p.full_name ?? "Member").split(" ")[0], kcal: n.kcal.value, protein: n.protein_g.value };
    });

    const festivals = BUILT_IN_FESTIVALS.filter((f) => window.includes(f.date)).map((f) => `${f.date}: ${f.name}`);
    const nice = (v: string | null | undefined) => v || "not set";

    const userMsg = [
      `Menu follows the strictest diet in the family (${nice(strictestDiet(diets))}). Key Member: diet ${nice(key?.diet_type)}, dosha ${nice(key?.primary_dosha)}, conditions ${(key?.conditions ?? []).join(", ") || "none listed"}.`,
      `Each person's daily Good Range: ${targets.map((t) => `${t.name} ${t.kcal} kcal / ${t.protein} g protein`).join("; ")}.`,
      needs.length
        ? `Dietary needs from members' medical reports:\n${needs.map((n) => `- ${n.label}. Favour: ${n.favour.join("; ") || "-"}. Go easy on: ${n.limit.join("; ") || "-"}`).join("\n")}`
        : "No member has a medical report on file, so plan around the Key Member's profile.",
      festivals.length ? `Festivals this week: ${festivals.join("; ")}.` : "No festival this week.",
      `Empty slots to fill (date slot):\n${open.join("\n")}`,
      `Dishes you may use (id | name | meal hint | kcal per serving | protein g per serving):\n` +
        prompt.map((d) => {
          const s = perServing(d);
          return `${d.id} | ${d.name} | ${(d.meal_hint ?? []).join("/") || "any"} | ${Math.round(s.kcal)} | ${s.protein != null ? Math.round(s.protein) : "?"}`;
        }).join("\n"),
    ].join("\n\n");

    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Low effort: the reply was being cut off mid-answer when thinking used up the allowance
      output_config: { format: betaZodOutputFormat(Proposal), effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    await recordSpend(supabase, { userId: user.id, kutumbhId, feature: "suggest-menu", model: MODEL, usage: response.usage });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't plan the week. Please try again." }, { status: 422 });
    }

    const slots = cleanProposal(response.parsed_output.slots, allowedMap, window, filled);
    if (!slots.length) return NextResponse.json({ error: "Couldn't plan the week. Please try again." }, { status: 422 });

    // Weekly averages: what is already planned plus what is proposed
    const plan = [
      ...(planned ?? []).filter((p) => p.food_item_id).map((p) => ({ date: p.planned_date as string, slot: p.meal_slot as string, dishId: p.food_item_id as string })),
      ...slots.flatMap((s) => s.dishIds.map((dishId) => ({ date: s.date, slot: s.slot, dishId }))),
    ];
    const byId = new Map(all.map((d) => [d.id, d]));
    const averages = weeklyAverages(plan, byId, targets);

    return NextResponse.json({
      summary: response.parsed_output.summary.slice(0, 400),
      window: { from: window[0], to: window[6] },
      keptCount: filled.size,
      diet: strictestDiet(diets),
      needs: needs.map((n) => n.label),
      slots: slots.map((s) => ({
        date: s.date, slot: s.slot, why: s.why,
        dishes: s.dishIds.map((id) => {
          const d = allowedMap.get(id)!;
          return { id, name: d.name, unit: d.serving_unit ?? "serving" };
        }),
      })),
      averages,
    });
  } catch (error) {
    const { message, status } = aiErrorMessage(error, "The menu planner");
    await logFault(supabase, { where: "suggest-menu", error, status, kutumbhId, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }
}
