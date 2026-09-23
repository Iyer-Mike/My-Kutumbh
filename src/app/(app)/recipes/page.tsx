import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import RecipeFilters from "@/components/RecipeFilters";
import { BRAND as B } from "@/lib/brand";
import { CUISINES, DIETS, INDIAN_CUISINES, dishTypeOf } from "@/lib/food-taxonomy";

type Search = { q?: string; cuisine?: string; diet?: string; type?: string };

const DIET_MARK: Record<string, string> = { vegan: "#2F7D32", veg: "#2F7D32", egg: "#C98A0B", nonveg: "#A23A1E" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const cuisine = sp.cuisine ?? "indian";
  const diet = sp.diet ?? "nonveg";           // a filter, not a judgement: show everything up to this
  const type = sp.type ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id, name, cuisine, diet, dish_type, serves, prep_time, cook_time, blurb, kcal, protein_g")
    .order("name")
    .limit(80);

  if (q.length >= 2) query = query.ilike("name", `%${q}%`);
  if (cuisine === "indian") query = query.in("cuisine", INDIAN_CUISINES);
  else if (cuisine !== "all") query = query.eq("cuisine", cuisine);
  const rank = DIETS.find((d) => d.key === diet)?.rank ?? 3;
  query = query.in("diet", DIETS.filter((d) => d.rank <= rank).map((d) => d.key));
  if (type) query = query.eq("dish_type", type);

  const { data: recipes } = await query;
  const rows = recipes ?? [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-5" style={{ background: B.headerGradient }}>
        <PageNav />
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>How it&apos;s cooked</p>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Recipes</h1>
        <p className="text-xs mt-1" style={{ color: B.gold }}>
          Ingredients, method and nutrition for every dish on the menu
        </p>
      </header>

      <main className="flex-1 px-4 py-5 grid gap-4">
        <RecipeFilters q={q} cuisine={cuisine} diet={diet} type={type} />

        {rows.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: B.muted }}>
            No recipes match. Try another cuisine, or clear the search.
          </p>
        ) : (
          <div className="grid gap-2">
            {rows.map((r) => (
              <Link key={r.id} href={`/recipes/${r.id}`}
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
                <span className="text-lg shrink-0" aria-hidden>{dishTypeOf(r.dish_type).icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: B.ink }}>
                    <span aria-hidden className="inline-flex items-center justify-center shrink-0"
                      style={{ width: 11, height: 11, border: `1.5px solid ${DIET_MARK[r.diet] ?? DIET_MARK.veg}`, borderRadius: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: DIET_MARK[r.diet] ?? DIET_MARK.veg }} />
                    </span>
                    <span className="truncate">{r.name}</span>
                  </p>
                  <p className="text-[11px] truncate" style={{ color: B.muted2 }}>
                    {CUISINES.find((c) => c.key === r.cuisine)?.label ?? "Indian"} · {dishTypeOf(r.dish_type).label}
                    {r.cook_time ? ` · ${r.cook_time} cooking` : ""}
                  </p>
                </div>
                <span className="text-xs tabular-nums shrink-0" style={{ color: B.muted }}>
                  {r.kcal != null ? `${Math.round(r.kcal)} kcal` : ""}
                </span>
              </Link>
            ))}
            {rows.length === 80 && (
              <p className="text-xs text-center pt-1" style={{ color: B.muted2 }}>
                Showing the first 80 — narrow it with a search or a filter.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

