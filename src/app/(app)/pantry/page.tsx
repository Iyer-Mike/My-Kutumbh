import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import PantryView, { type PantryItem, type ShoppingItem } from "@/components/PantryView";
import LiveFamily from "@/components/LiveFamily";
import { BRAND as B } from "@/lib/brand";
import { dayLabel, daysAheadLocal, todayLocal } from "@/lib/dates";
import { familyOf } from "@/lib/family";
import { ingredientNames } from "@/lib/ingredients";

export default async function PantryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id, role, kutumbhs(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const kutumbhId = membership?.kutumbh_id ?? null;
  const isPrime = membership?.role === "owner";
  const { timeZone } = await familyOf(supabase, user!.id);
  const today = todayLocal(timeZone);
  const kutumbhName = (membership?.kutumbhs as unknown as { name: string } | null)?.name ?? "your Kutumbh";

  let items: PantryItem[] = [];
  let shopping: ShoppingItem[] = [];
  let menuDays: { date: string; label: string; dishes: { name: string; ings: string[] }[] }[] = [];
  const names: Record<string, string> = {};

  if (kutumbhId) {
    const [{ data: pantry }, { data: list }, { data: people }] = await Promise.all([
      supabase.from("pantry_items")
        .select("id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note")
        .eq("kutumbh_id", kutumbhId).order("name"),
      supabase.from("shopping_items")
        .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at")
        .eq("kutumbh_id", kutumbhId).order("created_at", { ascending: false }).limit(120),
      supabase.from("family_roster")
        .select("id, full_name")
        .eq("kutumbh_id", kutumbhId),
    ]);
    items = (pantry ?? []) as PantryItem[];
    shopping = (list ?? []) as ShoppingItem[];
    for (const p of people ?? []) {
      names[p.id] = p.full_name?.split(" ")[0] ?? "Family";
    }

    // The next seven days' menu, dish by dish, with each dish's ingredients.
    // The shelf is compared in the browser so it stays live.
    const { data: plans } = await supabase
      .from("meal_plans")
      .select("planned_date, food_name, food_items(recipe_id)")
      .eq("kutumbh_id", kutumbhId)
      .gte("planned_date", today)
      .lte("planned_date", daysAheadLocal(6, timeZone))
      .order("planned_date");

    const recipeIds = [...new Set(
      (plans ?? [])
        .map((p) => (p.food_items as unknown as { recipe_id: number | null } | null)?.recipe_id)
        .filter((id): id is number => id != null),
    )];

    const byRecipe = new Map<number, string[]>();
    if (recipeIds.length) {
      const { data: recipes } = await supabase
        .from("recipes").select("id, name, ingredients").in("id", recipeIds);
      for (const r of recipes ?? []) byRecipe.set(r.id as number, ingredientNames(r.ingredients));
    }

    const days = new Map<string, Map<string, string[]>>();
    for (const p of plans ?? []) {
      const rid = (p.food_items as unknown as { recipe_id: number | null } | null)?.recipe_id;
      const day = days.get(p.planned_date as string) ?? new Map<string, string[]>();
      day.set(p.food_name as string, rid != null ? (byRecipe.get(rid) ?? []) : []);
      days.set(p.planned_date as string, day);
    }
    menuDays = [...days.entries()].map(([date, dishes]) => ({
      date,
      label: dayLabel(date, timeZone),
      dishes: [...dishes.entries()].map(([name, ings]) => ({ name, ings })),
    }));
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{kutumbhName}</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Pantry</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>
          {isPrime ? "You keep the shelf · all can flag low items" : "Flag low items for the Key Member"}
        </p>
      </header>

      <main className="flex-1 px-4 py-5">
        {kutumbhId ? (
          <>
          <LiveFamily kutumbhId={kutumbhId} tables="shopping_items,pantry_items" />
          <PantryView
            kutumbhId={kutumbhId}
            userId={user!.id}
            isPrime={isPrime}
            initialItems={items}
            initialShopping={shopping}
            menuDays={menuDays}
            memberNames={names}
            today={today}
          />
          </>
        ) : (
          <p className="text-sm text-center py-10" style={{ color: B.muted }}>
            Join or start a Kutumbh first.
          </p>
        )}
      </main>
    </div>
  );
}
