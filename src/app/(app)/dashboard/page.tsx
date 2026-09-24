import { createClient } from "@/lib/supabase/server";
import KutumbhLogo from "@/components/KutumbhLogo";
import DashboardTabs from "@/components/DashboardTabs";
import { redirect } from "next/navigation";
import { clampDay, dayLabel, longDateFor, todayLocal } from "@/lib/dates";
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
  const day = clampDay(date, 30, 6);
  const isToday = day === todayLocal();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, full_name, daily_kcal_goal")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role, kutumbhs(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const kutumbhId = membership?.kutumbh_id ?? null;
  const isPrime   = membership?.role === "owner";
  const rawKutumbh = membership?.kutumbhs;
  const kutumbhName: string = (Array.isArray(rawKutumbh)
    ? (rawKutumbh[0] as { name: string } | undefined)?.name
    : (rawKutumbh as { name: string } | null | undefined)?.name) ?? "My Kutumbh";

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  const { data: logs } = await supabase
    .from("meal_logs")
    .select("id, food_name, meal_slot, quantity_g, quantity_unit, calories, nutrition_estimated")
    .eq("user_id", user!.id)
    .eq("logged_date", day);

  const plansQuery = supabase
    .from("meal_plans")
    .select("id, user_id, food_name, meal_slot, food_items(needs_review, category, serving_unit, serving_weight_g, calories)")
    .eq("planned_date", day)
    .order("created_at", { ascending: true });

  const { data: planRows } = await (kutumbhId
    ? plansQuery.eq("kutumbh_id", kutumbhId)
    : plansQuery.eq("user_id", user!.id));

  const plans = ((planRows ?? []) as MealPlanRow[]).map(({ food_items, ...p }) => {
    const fi = Array.isArray(food_items) ? food_items[0] : food_items;
    const w  = fi?.serving_unit === "g" ? 100 : (fi?.serving_weight_g ?? 100);
    return {
      ...p,
      needs_review:     !!fi?.needs_review,
      category:         fi?.category ?? null,
      serving_unit:     fi?.serving_unit ?? null,
      kcal_per_serving: fi?.calories != null ? Math.round((fi.calories * w) / 100) : null,
    };
  });

  // Custom pool names for today (only present when someone renamed one)
  const poolNames: Record<string, string> = {};
  if (kutumbhId) {
    const { data: pools } = await supabase
      .from("meal_pools")
      .select("meal_slot, name")
      .eq("kutumbh_id", kutumbhId)
      .eq("planned_date", day);
    for (const p of pools ?? []) poolNames[p.meal_slot] = p.name;
  }

  // First names of whoever planned today's items ("planned by …")
  const plannerIds = [...new Set(plans.map((p) => p.user_id))];
  const memberNames: Record<string, string> = {};
  if (plannerIds.length) {
    const { data: people } = await supabase
      .from("family_roster")
      .select("id, full_name")
      .in("id", plannerIds);
    for (const p of people ?? []) memberNames[p.id] = p.full_name?.split(" ")[0] ?? "Family";
  }

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

        <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            {isToday ? longDateFor(day) : `${dayLabel(day)} · ${longDateFor(day)}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xl font-medium text-white">Namaste, {firstName} 🙏</p>
            {membership && (
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
            {totalKcal > 0 ? `${Math.round(totalKcal)} kcal logged today` : "What have you eaten today?"}
          </p>
        </div>

        <DayNav date={day} back={30} ahead={6} path="/dashboard" onDark />
      </header>

      {/* ── Tabs + content ── */}
      <main className="flex-1 px-4 py-5">
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
