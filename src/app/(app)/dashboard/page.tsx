import { createClient } from "@/lib/supabase/server";
import KutumbhLogo from "@/components/KutumbhLogo";
import DashboardSlotCard from "@/components/DashboardSlotCard";
import { redirect } from "next/navigation";

const SLOTS = [
  { key: "breakfast", name: "Breakfast", icon: "☀️", time: "7 – 9 am" },
  { key: "lunch",     name: "Lunch",     icon: "🌤️", time: "12 – 2 pm" },
  { key: "dinner",   name: "Dinner",    icon: "🌙", time: "7 – 9 pm" },
  { key: "other",    name: "Other",     icon: "＋", time: "Any time" },
];

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// Match the format used when saving: toISOString().split("T")[0] (UTC date)
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

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  // No .order() — avoids silent failure if created_at doesn't exist
  const { data: logs } = await supabase
    .from("meal_logs")
    .select("id, food_name, meal_slot, quantity_g, quantity_unit, calories")
    .eq("user_id", user!.id)
    .eq("logged_date", todayISO());

  // Group items by slot
  const slotItems: Record<string, MealLog[]> = {};
  let totalKcal = 0;

  for (const log of (logs ?? []) as MealLog[]) {
    const s = log.meal_slot;
    if (!slotItems[s]) slotItems[s] = [];
    slotItems[s].push(log);
    totalKcal += log.calories ?? 0;
  }

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
                My Kutumbh
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

      {/* ── Meal slots ── */}
      <main className="flex-1 px-4 py-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#8A9085" }}>
          Today&apos;s Meals
        </p>

        {SLOTS.map(({ key, name, icon, time }) => (
          <DashboardSlotCard
            key={key}
            slotKey={key}
            name={name}
            icon={icon}
            time={time}
            items={slotItems[key] ?? []}
          />
        ))}

        {/* Summary strip */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between mt-2"
          style={{ background: "#1C2B1C" }}
        >
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Today&apos;s total</p>
            <p className="text-lg font-semibold text-white mt-0.5">
              {totalKcal > 0 ? `${Math.round(totalKcal)} kcal` : "0 kcal"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Items logged</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: "#8FBF88" }}>
              {(logs ?? []).length > 0
                ? `${(logs ?? []).length} item${(logs ?? []).length > 1 ? "s" : ""}`
                : "— log to start"}
            </p>
          </div>
        </div>
      </main>

    </div>
  );
}
