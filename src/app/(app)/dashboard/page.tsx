import { createClient } from "@/lib/supabase/server";
import KutumbhLogo from "@/components/KutumbhLogo";
import DashboardTabs from "@/components/DashboardTabs";
import LiveFamily from "@/components/LiveFamily";
import { redirect } from "next/navigation";
import { clampDay, dayLabel, todayLocal } from "@/lib/dates";
import { familyOf } from "@/lib/family";
import DayNav from "@/components/DayNav";

type MealLog = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
};

type PlanFood = {
  needs_review: boolean | null;
  category: string | null;
  serving_unit: string | null;
  serving_weight_g: number | null;
  calories: number | null;
  recipe_id: number | null;
};

type MealPlanRow = {
  id: string;
  user_id: string;
  food_name: string;
  meal_slot: string;
  food_items: PlanFood | PlanFood[] | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  // One day at a time: a month back to catch up, a week ahead to plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // A menu put up in the kitchen should reach the others in a second or
  // two, and every question asked of the database in turn is another wait.
  // Whatever can be asked at the same time, is.
  const [membership, { data: profile }] = await Promise.all([
    familyOf(supabase, user!.id),
    supabase
      .from("profiles")
      .select("onboarding_complete, full_name, daily_kcal_goal")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const { kutumbhId, isPrime, timeZone } = membership;
  const kutumbhName = membership.kutumbhName ?? "My Kutumbh";
  const day = clampDay(date, 30, 6, timeZone);
  const isToday = day === todayLocal(timeZone);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  const plansQuery = supabase
    .from("meal_plans")
    .select("id, user_id, food_name, meal_slot, food_items(needs_review, category, serving_unit, serving_weight_g, calories, recipe_id)")
    .eq("planned_date", day)
    .order("created_at", { ascending: true });

  const [{ data: logs }, { data: planRows }, poolRes, rosterRes] = await Promise.all([
    supabase
      .from("meal_logs")
      .select("id, food_name, meal_slot, quantity_g, quantity_unit, calories, nutrition_estimated")
      .eq("user_id", user!.id)
      .eq("logged_date", day),
    kutumbhId ? plansQuery.eq("kutumbh_id", kutumbhId) : plansQuery.eq("user_id", user!.id),
    // Custom pool names for the day (only present when someone renamed one)
    kutumbhId
      ? supabase.from("meal_pools").select("meal_slot, name").eq("kutumbh_id", kutumbhId).eq("planned_date", day)
      : Promise.resolve({ data: [] as { meal_slot: string; name: string }[] }),
    // First names for "planned by …" — the roster only ever shows this family
    kutumbhId
      ? supabase.from("family_roster").select("id, full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const plans = ((planRows ?? []) as MealPlanRow[]).map(({ food_items, ...p }) => {
    const fi = Array.isArray(food_items) ? food_items[0] : food_items;
    const w  = fi?.serving_unit === "g" ? 100 : (fi?.serving_weight_g ?? 100);
    return {
      ...p,
      needs_review:     !!fi?.needs_review,
      category:         fi?.category ?? null,
      serving_unit:     fi?.serving_unit ?? null,
      kcal_per_serving: fi?.calories != null ? Math.round((fi.calories * w) / 100) : null,
      recipe_id:        fi?.recipe_id ?? null,
    };
  });

  const poolNames: Record<string, string> = {};
  for (const p of poolRes.data ?? []) poolNames[p.meal_slot] = p.name;

  const memberNames: Record<string, string> = {};
  for (const p of rosterRes.data ?? []) memberNames[p.id] = p.full_name?.split(" ")[0] ?? "Family";

  const totalKcal = ((logs ?? []) as MealLog[]).reduce((s, l) => s + (l.calories ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F3EEFA" }}>

      {/* ── Header ── */}
      <header
        className="px-5 pt-safe"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 70%, #4E3080 100%)" }}
      >
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <KutumbhLogo size={38} color="#ffffff" />
            <div>
              <p className="text-xl leading-tight text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
                {kutumbhName}
              </p>
              <p className="text-xs leading-tight" style={{ color: "#C9B8E4" }}>मेरा कुटुम्ब</p>
            </div>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            {firstName[0].toUpperCase()}
          </div>
        </div>

        {/* The day and its date are read off the ‹ day › row just below */}
        <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xl font-medium text-white">Namaste, {firstName} 🙏</p>
            {kutumbhId && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={isPrime
                  ? { background: "#F2B531", color: "#2A1646" }
                  : { background: "rgba(255,255,255,0.15)", color: "#DDD3EF" }}
              >
                {isPrime ? "★ Prime Member" : "Member"}
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: "#C9B8E4" }}>
            {totalKcal > 0
              ? `${Math.round(totalKcal)} kcal logged ${isToday ? "today" : dayLabel(day, timeZone).toLowerCase()}`
              : isToday ? "What have you eaten today?" : "Nothing logged for this day"}
          </p>
        </div>

        <DayNav date={day} back={30} ahead={6} path="/dashboard" onDark />
      </header>

      {/* ── Tabs + content ── */}
      <main className="flex-1 px-4 py-5">
        {kutumbhId && <LiveFamily kutumbhId={kutumbhId} tables="meal_plans,meal_pools" />}
        <DashboardTabs
          logs={(logs ?? []) as MealLog[]}
          totalKcal={totalKcal}
          dailyKcalGoal={profile?.daily_kcal_goal ?? null}
          day={day}
          initialPlans={plans}
          poolNames={poolNames}
          memberNames={memberNames}
          userId={user!.id}
          kutumbhId={kutumbhId}
        />
      </main>

    </div>
  );
}
