import { createClient } from "@/lib/supabase/server";
import KutumbhLogo from "@/components/KutumbhLogo";
import DashboardTabs from "@/components/DashboardTabs";
import { redirect } from "next/navigation";

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

type MealLog = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
};

type MealPlan = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, full_name")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, kutumbhs(name)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const kutumbhId = membership?.kutumbh_id ?? null;
  const rawKutumbh = membership?.kutumbhs;
  const kutumbhName: string = (Array.isArray(rawKutumbh)
    ? (rawKutumbh[0] as { name: string } | undefined)?.name
    : (rawKutumbh as { name: string } | null | undefined)?.name) ?? "My Kutumbh";

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  const { data: logs } = await supabase
    .from("meal_logs")
    .select("id, food_name, meal_slot, quantity_g, quantity_unit, calories")
    .eq("user_id", user!.id)
    .eq("logged_date", todayISO());

  const plansQuery = supabase
    .from("meal_plans")
    .select("id, food_name, meal_slot, quantity_g, quantity_unit")
    .eq("planned_date", todayISO());

  const { data: plans } = await (kutumbhId
    ? plansQuery.eq("kutumbh_id", kutumbhId)
    : plansQuery.eq("user_id", user!.id));

  const totalKcal = ((logs ?? []) as MealLog[]).reduce((s, l) => s + (l.calories ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>

      {/* ── Header ── */}
      <header
        className="px-5 pt-safe"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <KutumbhLogo size={38} color="#ffffff" />
            <div>
              <p className="text-xl leading-tight text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
                {kutumbhName}
              </p>
              <p className="text-xs leading-tight" style={{ color: "#8FBF88" }}>मेरा कुटुम्ब</p>
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
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{todayLabel()}</p>
          <p className="text-xl font-medium text-white mt-0.5">Namaste, {firstName} 🙏</p>
          <p className="text-xs mt-1" style={{ color: "#8FBF88" }}>
            {totalKcal > 0 ? `${Math.round(totalKcal)} kcal logged today` : "What have you eaten today?"}
          </p>
        </div>
      </header>

      {/* ── Tabs + content ── */}
      <main className="flex-1 px-4 py-5">
        <DashboardTabs
          logs={(logs ?? []) as MealLog[]}
          totalKcal={totalKcal}
          initialPlans={(plans ?? []) as MealPlan[]}
          userId={user!.id}
          kutumbhId={kutumbhId}
        />
      </main>

    </div>
  );
}
