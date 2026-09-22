import type { SupabaseClient } from "@supabase/supabase-js";
import { todayLocal, daysAgoLocal } from "@/lib/dates";
import type { FoodData, LogEntry, Profile } from "./types";

export const FOOD_COLS =
  "name, category, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, iron_mg, calcium_mg, vitamin_b12_mcg, vitamin_c_mg, folate_mcg, sodium_mg, potassium_mg, rasa, virya, vata_effect, pitta_effect, kapha_effect, ingredients";

export type InsightsData = {
  targetId: string;
  viewingOther: boolean;
  name: string;
  profile: Profile;
  entries: LogEntry[];                       // last 30 days
  reports: { report_date: string | null; extracted_values: Record<string, unknown> | null }[];
  foods: FoodData[];                         // catalogue + this family's dishes
  familyDishNames: string[];
  today: string;
  from30: string;
};

/**
 * Everything Insights and the coach need about one member. A member sees
 * their own data; the Prime Member may ask for any member of their Kutumbh.
 */
export async function loadInsightsData(
  supabase: SupabaseClient, viewerId: string, requestedMember?: string | null,
): Promise<InsightsData> {
  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role")
    .eq("user_id", viewerId)
    .limit(1)
    .maybeSingle();

  let targetId = viewerId;
  if (requestedMember && requestedMember !== viewerId && membership?.role === "owner") {
    const { data: inFamily } = await supabase
      .from("kutumbh_members")
      .select("user_id")
      .eq("kutumbh_id", membership.kutumbh_id)
      .eq("user_id", requestedMember)
      .maybeSingle();
    if (inFamily) targetId = requestedMember;
  }

  const today = todayLocal();
  const from30 = daysAgoLocal(29);

  const [{ data: profile }, { data: logRows }, { data: reports }, { data: foodRows }, { data: dishRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, date_of_birth, gender, height_cm, weight_kg, activity_level, daily_kcal_goal, primary_dosha, diet_type, allergies, conditions, medications")
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
    membership?.kutumbh_id
      ? supabase.from("food_items").select("name").eq("kutumbh_id", membership.kutumbh_id).limit(200)
      : Promise.resolve({ data: [] as { name: string }[] }),
  ]);

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

  return {
    targetId,
    viewingOther: targetId !== viewerId,
    name: profile?.full_name ?? "Family member",
    profile: {
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
      medications:     profile?.medications ?? [],
    },
    entries,
    reports: reports ?? [],
    foods: (foodRows ?? []) as FoodData[],
    familyDishNames: (dishRows ?? []).map((d) => d.name),
    today,
    from30,
  };
}
