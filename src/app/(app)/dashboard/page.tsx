import { createClient } from "@/lib/supabase/server";
import KutumbhLogo from "@/components/KutumbhLogo";
import WhatsForToday, { type MealSuggestion } from "@/components/WhatsForToday";
import LiveFamily from "@/components/LiveFamily";
import { redirect } from "next/navigation";
import { clampDay, daysAheadLocal, longDateFor, todayLocal } from "@/lib/dates";
import { familyOf } from "@/lib/family";
import DayNav from "@/components/DayNav";
import CouldNotRead from "@/components/CouldNotRead";
import Face from "@/components/Face";
import { signedFaces } from "@/lib/faces";
import Link from "next/link";
import type { QuickPick } from "@/components/PlanSlotCard";
import { builtInOn, festivalMenu, shortFestivalName, EVERYDAY, MEAL_KEYS } from "@/lib/festivals";
import { FOOD_NUTRIENT_COLS, perServing, type FoodNutrientRow, type Nutr } from "@/lib/serving-nutrition";

type MealLog = {
  id: string;
  food_item_id: string | null;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
  food_items?: (FoodNutrientRow & { recipe_id: number | null }) | (FoodNutrientRow & { recipe_id: number | null })[] | null;
};

type PlanFood = FoodNutrientRow & {
  needs_review: boolean | null;
  category: string | null;
  recipe_id: number | null;
};

type MealPlanRow = {
  id: string;
  user_id: string;
  food_item_id: string | null;
  food_name: string;
  meal_slot: string;
  food_items: PlanFood | PlanFood[] | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string; fest?: string }> }) {
  const { date, fest } = await searchParams;
  // One day at a time: a month back to catch up, a week ahead to plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // A menu put up in the kitchen should reach the others in a second or
  // two, and every question asked of the database in turn is another wait.
  // Whatever can be asked at the same time, is.
  const [membership, { data: profile, error: profileError }] = await Promise.all([
    familyOf(supabase, user!.id),
    supabase
      .from("profiles")
      .select("onboarding_complete, full_name, daily_kcal_goal")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  // A question the database refused to answer is not the same as a new face.
  // Sending someone through the front door again because their key had just
  // been changed is how a returning member was asked to sign up afresh.
  if (profileError) return <CouldNotRead />;

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  const { kutumbhId, isPrime, timeZone } = membership;
  const kutumbhName = membership.kutumbhName ?? "My Kutumbh";
  // A festival day can be a long way off; it is opened from the Festival days list
  const day = clampDay(date, 30, fest === "1" ? 400 : 6, timeZone);
  const today = todayLocal(timeZone);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";
  // Asked for on its own, so a page still opens where the photo store has
  // not been made yet
  const { data: faceRow } = await supabase.from("profiles").select("photo_path").eq("id", user!.id).maybeSingle();
  const myPath: string | null = faceRow?.photo_path ?? null;
  const myFace = (await signedFaces(supabase, [myPath]))[myPath ?? ""];

  const plansQuery = supabase
    .from("meal_plans")
    .select(`id, user_id, food_item_id, food_name, meal_slot, food_items(needs_review, category, recipe_id, ${FOOD_NUTRIENT_COLS})`)
    .eq("planned_date", day)
    .order("created_at", { ascending: true });

  const [{ data: logs }, { data: planRows }, poolRes, rosterRes, sugRes] = await Promise.all([
    supabase
      .from("meal_logs")
      .select(`id, food_item_id, food_name, meal_slot, quantity_g, quantity_unit, calories, nutrition_estimated, food_items(recipe_id, ${FOOD_NUTRIENT_COLS})`)
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
    // One suggested meal per empty slot (family menu, same weekday last week,
    // or last time). A day still ahead is planned, not logged, so none there.
    day <= today
      ? supabase.rpc("suggest_meals", { p_date: day })
      : Promise.resolve({ data: [] as unknown[] }),
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
      n:                perServing(fi) as Nutr | null,
    };
  });

  const poolNames: Record<string, string> = {};
  for (const p of poolRes.data ?? []) poolNames[p.meal_slot] = p.name;

  const memberNames: Record<string, string> = {};
  for (const p of rosterRes.data ?? []) memberNames[p.id] = p.full_name?.split(" ")[0] ?? "Family";

  const tomorrow = daysAheadLocal(1, timeZone);

  // Is this a festival day? The app's list first, then the family's own
  const builtIn = builtInOn(day);
  let festivalName: string | null = builtIn[0] ?? null;
  if (!festivalName && kutumbhId) {
    const { data: own } = await supabase.from("family_festivals").select("name").eq("kutumbh_id", kutumbhId).eq("festival_date", day).limit(1);
    festivalName = own?.[0]?.name ?? null;
  }
  // Quick picks for each meal's "Change menu": a festival's own dishes on a festival day,
  // otherwise what this family plans most often, topped up with everyday dishes (at least five)
  const quickPicks: Record<string, QuickPick[]> = {};
  if (isPrime) {
    const want: Record<string, string[]> = {};
    if (festivalName) {
      for (const x of festivalMenu(builtIn)) (want[x.meal] ??= []).push(x.name);
    } else {
      const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
      const { data: hist } = kutumbhId
        ? await supabase.from("meal_plans").select("meal_slot, food_name").eq("kutumbh_id", kutumbhId).gte("planned_date", since).limit(1500)
        : { data: [] as { meal_slot: string; food_name: string }[] };
      const count: Record<string, Record<string, number>> = {};
      for (const h of hist ?? []) { const c = (count[h.meal_slot] ??= {}); c[h.food_name] = (c[h.food_name] ?? 0) + 1; }
      for (const m of MEAL_KEYS) {
        const often = Object.entries(count[m] ?? {}).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 8);
        want[m] = [...often, ...EVERYDAY[m].filter((n) => !often.includes(n))].slice(0, Math.max(often.length, 8));
      }
    }
    const names = [...new Set(Object.values(want).flat())];
    const { data: fd } = await supabase
      .from("food_items")
      .select("id, name, category, diet, meal_hint, recipe_id, calories, serving_weight_g, serving_unit, kutumbh_id, needs_review")
      .in("name", names);
    const byName = new Map<string, QuickPick>();
    for (const f of (fd ?? []) as QuickPick[]) {
      const have = byName.get(f.name);
      // a family's own dish of the same name wins over the shared one
      if (!have || f.kutumbh_id) byName.set(f.name, f);
    }
    for (const [m, list] of Object.entries(want)) quickPicks[m] = list.map((n) => byName.get(n)).filter(Boolean) as QuickPick[];
  }
  const festivalTab = festivalName
    ? `${shortFestivalName(festivalName)} · ${new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : null;

  return (
    <>
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
          <Link href="/profile" aria-label="Your profile">
            <Face url={myFace} name={firstName} size={38} onDark />
          </Link>
        </div>

        <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          {/* A greeting belongs to today, whichever day is being read below */}
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            {longDateFor(today)}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xl font-medium text-white">Namaste, {firstName} 🙏</p>
            {kutumbhId && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={isPrime
                  ? { background: "#F2B531", color: "#2A1646" }
                  : { background: "rgba(255,255,255,0.15)", color: "#DDD3EF" }}
              >
                {isPrime ? "★ Key Member" : "Member"}
              </span>
            )}
          </div>
        </div>

        {fest === "1" && day > daysAheadLocal(6, timeZone) ? (
          <Link href="/festivals" className="inline-flex items-center px-3 rounded-xl text-sm font-semibold"
            style={{ minHeight: 44, background: "rgba(255,255,255,0.14)", color: "#fff" }}>
            ‹ Festival days · {longDateFor(day)}
          </Link>
        ) : (
          <DayNav date={day} back={30} ahead={6} path="/dashboard" onDark />
        )}
      </header>

      {/* ── Tabs + content ── */}
      <main className="flex-1 px-4 py-5">
        {kutumbhId && <LiveFamily kutumbhId={kutumbhId} tables="meal_plans,meal_pools" />}
        <WhatsForToday
          suggestions={(sugRes.data ?? []) as MealSuggestion[]}
          logs={((logs ?? []) as MealLog[]).map(({ food_items, ...l }) => {
            const fi = Array.isArray(food_items) ? food_items[0] : food_items;
            return { ...l, recipe_id: fi?.recipe_id ?? null, n: perServing(fi) as Nutr | null };
          })}
          dailyKcalGoal={profile?.daily_kcal_goal ?? null}
          day={day}
          today={today}
          tomorrow={tomorrow}
          isPrime={isPrime}
          festivalTab={festivalTab}
          quickPicks={quickPicks}
          quickLabel={festivalName ? `Made for ${shortFestivalName(festivalName)}` : "Often on your menu"}
          plans={plans}
          poolNames={poolNames}
          memberNames={memberNames}
          userId={user!.id}
          kutumbhId={kutumbhId}
        />
      </main>

      </div>
    </>
  );
}
