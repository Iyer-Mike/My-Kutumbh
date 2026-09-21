import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import { SLOTS, slotLabel } from "@/lib/meal-slots";

type Log = {
  id: string;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
  logged_date: string;
};

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function dayLabel(iso: string) {
  if (iso === isoDaysAgo(0)) return "Today";
  if (iso === isoDaysAgo(1)) return "Yesterday";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// Prime Member only: what a family member has eaten over the last 7 days.
export default async function MemberConsumptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!me || me.role !== "owner") redirect("/family");

  const { data: member } = await supabase
    .from("kutumbh_members")
    .select("user_id")
    .eq("kutumbh_id", me.kutumbh_id)
    .eq("user_id", memberId)
    .maybeSingle();

  if (!member) redirect("/family");

  const [{ data: profile }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("full_name, primary_dosha, daily_kcal_goal").eq("id", memberId).maybeSingle(),
    supabase
      .from("meal_logs")
      .select("id, food_name, meal_slot, quantity_g, quantity_unit, calories, nutrition_estimated, logged_date")
      .eq("user_id", memberId)
      .gte("logged_date", isoDaysAgo(6))
      .order("logged_date", { ascending: false })
      .order("logged_at", { ascending: true }),
  ]);

  const days: { date: string; logs: Log[]; kcal: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = isoDaysAgo(i);
    const dayLogs = ((logs ?? []) as Log[]).filter((l) => l.logged_date === date);
    days.push({ date, logs: dayLogs, kcal: Math.round(dayLogs.reduce((s, l) => s + (l.calories ?? 0), 0)) });
  }

  const loggedDays = days.filter((d) => d.logs.length > 0);
  const avgKcal = loggedDays.length
    ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length)
    : 0;
  const goal = profile?.daily_kcal_goal ?? null;
  const name = profile?.full_name ?? "Family member";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>
      <header
        className="px-5 pt-safe pb-5"
        style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}
      >
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          <Link href="/family" style={{ color: "rgba(255,255,255,0.5)" }}>Kutumbh</Link> · last 7 days
        </p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>{name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <p className="text-xs" style={{ color: "#8FBF88" }}>
            {loggedDays.length ? `Avg ${avgKcal} kcal on ${loggedDays.length} logged day${loggedDays.length > 1 ? "s" : ""}` : "Nothing logged this week"}
          </p>
          {goal && <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Goal {goal} kcal</p>}
          {profile?.primary_dosha && (
            <p className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.6)" }}>{profile.primary_dosha}</p>
          )}
        </div>
      </header>

      <main className="flex-1 px-5 py-5 space-y-3">
        {days.map((day) => {
          const over = goal != null && day.kcal > goal;
          return (
            <section key={day.date} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E2E1D8" }}>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold" style={{ color: "#1C201C" }}>{dayLabel(day.date)}</p>
                <p className="text-xs font-semibold" style={{ color: day.logs.length ? (over ? "#C8632A" : "#4A7C44") : "#B5B0A8" }}>
                  {day.logs.length ? `${day.kcal} kcal · ${day.logs.length} item${day.logs.length > 1 ? "s" : ""}` : "Not logged"}
                </p>
              </div>

              {day.logs.length > 0 && (
                <div style={{ borderTop: "1px solid #F0EFE8" }}>
                  {[...SLOTS.map((s) => s.key as string), "other"].map((slot) => {
                    const slotLogs = day.logs.filter((l) => l.meal_slot === slot);
                    if (!slotLogs.length) return null;
                    return (
                      <div key={slot} className="px-4 py-2" style={{ borderBottom: "1px solid #F6F5EE" }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#8A9085" }}>
                          {slot === "other" ? "Other" : slotLabel(slot)}
                        </p>
                        {slotLogs.map((l) => (
                          <div key={l.id} className="flex items-center justify-between py-0.5">
                            <p className="text-sm truncate" style={{ color: "#1C201C" }}>{l.food_name}</p>
                            <p className="text-xs flex-shrink-0 ml-3" style={{ color: "#8A9085" }}>
                              {l.quantity_g} {l.quantity_unit ?? "serving"}
                              {l.calories == null
                                ? " · — kcal"
                                : l.nutrition_estimated
                                  ? ` · ~${Math.round(l.calories)} kcal est.`
                                  : ` · ${Math.round(l.calories)} kcal`}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
