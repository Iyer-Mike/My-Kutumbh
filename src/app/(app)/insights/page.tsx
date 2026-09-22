import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import InsightsView, { type InsightsPeriod } from "@/components/InsightsView";
import { todayLocal, daysAgoLocal } from "@/lib/dates";
import { computeNeeds } from "@/lib/insights/needs";
import { summarizeIntake } from "@/lib/insights/intake";
import { summarizeAyurveda } from "@/lib/insights/ayurveda";
import { evaluateLabs, latestLabValues } from "@/lib/insights/labs";
import type { FoodData, LogEntry, Profile } from "@/lib/insights/types";

const FOOD_COLS =
  "name, category, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, iron_mg, calcium_mg, vitamin_b12_mcg, vitamin_c_mg, folate_mcg, sodium_mg, potassium_mg, rasa, virya, vata_effect, pitta_effect, kapha_effect, ingredients";

// Insights are individual. A member sees their own; the Prime Member can
// open any member of their Kutumbh with ?member=<user id>.
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role")
    .eq("user_id", me)
    .limit(1)
    .maybeSingle();

  let targetId = me;
  if (member && member !== me && membership?.role === "owner") {
    const { data: inFamily } = await supabase
      .from("kutumbh_members")
      .select("user_id")
      .eq("kutumbh_id", membership.kutumbh_id)
      .eq("user_id", member)
      .maybeSingle();
    if (inFamily) targetId = member;
  }
  const viewingOther = targetId !== me;

  const today = todayLocal();
  const from30 = daysAgoLocal(29);

  const [{ data: profile }, { data: logRows }, { data: reports }, { data: foodRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, date_of_birth, gender, height_cm, weight_kg, activity_level, daily_kcal_goal, primary_dosha, diet_type, allergies, conditions")
      .eq("id", targetId)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select(`logged_date, meal_slot, food_name, quantity_g, quantity_unit, calories, protein_g, nutrition_estimated, food_items(${FOOD_COLS})`)
      .eq("user_id", targetId)
      .gte("logged_date", from30)
      .lte("logged_date", today),
    supabase
      .from("medical_records")
      .select("report_date, extracted_values")
      .eq("user_id", targetId)
      .order("report_date", { ascending: false }),
    supabase.from("food_items").select(FOOD_COLS).limit(1000),
  ]);

  const p: Profile = {
    date_of_birth:   profile?.date_of_birth ?? null,
    gender:          profile?.gender ?? null,
    height_cm:       profile?.height_cm ?? null,
    weight_kg:       profile?.weight_kg ?? null,
    activity_level:  profile?.activity_level ?? null,
    daily_kcal_goal: profile?.daily_kcal_goal ?? null,
    primary_dosha:   profile?.primary_dosha ?? null,
    diet_type:       profile?.diet_type ?? null,
    allergies:       profile?.allergies ?? [],
    conditions:      profile?.conditions ?? [],
  };

  const entries: LogEntry[] = (logRows ?? []).map((r) => {
    const fi = Array.isArray(r.food_items) ? r.food_items[0] : r.food_items;
    return {
      logged_date: r.logged_date,
      meal_slot: r.meal_slot,
      food_name: r.food_name,
      quantity_g: Number(r.quantity_g),
      quantity_unit: r.quantity_unit,
      calories: r.calories != null ? Number(r.calories) : null,
      protein_g: r.protein_g != null ? Number(r.protein_g) : null,
      nutrition_estimated: r.nutrition_estimated,
      food: (fi as FoodData | null) ?? null,
    };
  });

  const needs = computeNeeds(p, today);
  const labValues = latestLabValues(reports ?? []);
  const foods = (foodRows ?? []) as FoodData[];

  const period = (key: InsightsPeriod["key"], label: string, from: string): InsightsPeriod => {
    const inRange = entries.filter((e) => e.logged_date >= from && e.logged_date <= today);
    const intake = summarizeIntake(entries, from, today);
    return {
      key, label, intake,
      ayurveda: summarizeAyurveda(inRange, p.primary_dosha),
      flags: evaluateLabs(labValues, { intake, needs, foods, allergies: p.allergies ?? [] }),
    };
  };

  const periods = [
    period("today", "Today", today),
    period("week", "7 days", daysAgoLocal(6)),
    period("month", "30 days", from30),
  ];

  const name = profile?.full_name ?? "Family member";
  const reportDate = reports?.[0]?.report_date ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          {viewingOther ? "Prime Member view" : "Your nutrition & health"}
        </p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
          {viewingOther ? `${name}'s Insights` : "Insights"}
        </h1>
        <p className="text-xs mt-1" style={{ color: "#8FBF88" }}>
          {reportDate
            ? `Using the lab report of ${new Date(`${reportDate}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`
            : "No lab report yet — upload one on Profile for health-based food guidance"}
        </p>
      </header>

      <main className="flex-1 px-4 py-5">
        <InsightsView
          periods={periods}
          needs={needs}
          primaryDosha={p.primary_dosha}
          hasReport={!!reportDate}
          viewingOther={viewingOther}
        />
      </main>
    </div>
  );
}
