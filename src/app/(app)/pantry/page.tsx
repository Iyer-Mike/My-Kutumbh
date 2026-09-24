import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import PantryView, { type PantryItem, type ShoppingItem } from "@/components/PantryView";
import { BRAND as B } from "@/lib/brand";
import { daysAheadLocal, todayLocal } from "@/lib/dates";
import { haveIt, ingredientNames } from "@/lib/ingredients";

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
  const kutumbhName = (membership?.kutumbhs as unknown as { name: string } | null)?.name ?? "your Kutumbh";

  let items: PantryItem[] = [];
  let shopping: ShoppingItem[] = [];
  let needed: { name: string; dishes: string[] }[] = [];
  const names: Record<string, string> = {};

  if (kutumbhId) {
    const [{ data: pantry }, { data: list }, { data: people }] = await Promise.all([
      supabase.from("pantry_items")
        .select("id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note")
        .eq("kutumbh_id", kutumbhId).order("name"),
      supabase.from("shopping_items")
        .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at")
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

    // What the next three days' menu needs that the shelf hasn't got
    const { data: plans } = await supabase
      .from("meal_plans")
      .select("food_name, food_items(recipe_id)")
      .eq("kutumbh_id", kutumbhId)
      .gte("planned_date", todayLocal())
      .lte("planned_date", daysAheadLocal(2));

    const recipeIds = [...new Set(
      (plans ?? [])
        .map((p) => (p.food_items as unknown as { recipe_id: number | null } | null)?.recipe_id)
        .filter((id): id is number => id != null),
    )];

    if (recipeIds.length) {
      const { data: recipes } = await supabase
        .from("recipes").select("id, name, ingredients").in("id", recipeIds);

      const onShelf = items.map((i) => i.name);
      const openNames = shopping.filter((s) => s.status === "open").map((s) => s.name);
      const wanted = new Map<string, Set<string>>();

      for (const r of recipes ?? []) {
        for (const ing of ingredientNames(r.ingredients)) {
          if (haveIt(ing, onShelf) || haveIt(ing, openNames)) continue;   // have it, or already listed
          const key = ing.toLowerCase();
          if (!wanted.has(key)) wanted.set(key, new Set());
          wanted.get(key)!.add(r.name);
        }
      }
      needed = [...wanted.entries()]
        .map(([key, dishes]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          dishes: [...dishes],
        }))
        .sort((a, b) => b.dishes.length - a.dishes.length || a.name.localeCompare(b.name))
        .slice(0, 30);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{kutumbhName}</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Pantry Shelf</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>
          {isPrime ? "You keep the shelf · anyone can flag what's running low" : "Flag anything running low for the Prime Member"}
        </p>
      </header>

      <main className="flex-1 px-4 py-5">
        {kutumbhId ? (
          <PantryView
            kutumbhId={kutumbhId}
            userId={user!.id}
            isPrime={isPrime}
            initialItems={items}
            initialShopping={shopping}
            fromMenu={needed}
            memberNames={names}
            today={todayLocal()}
          />
        ) : (
          <p className="text-sm text-center py-10" style={{ color: B.muted }}>
            Join or start a Kutumbh first — the shelf belongs to the family.
          </p>
        )}
      </main>
    </div>
  );
}
