import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import { BRAND as B } from "@/lib/brand";
import { CUISINES, dietLabel, dishTypeOf } from "@/lib/food-taxonomy";
import { slotLabel } from "@/lib/meal-slots";

const DIET_MARK: Record<string, string> = { vegan: "#2F7D32", veg: "#2F7D32", egg: "#C98A0B", nonveg: "#A23A1E" };

const EFFECT_WORD: Record<string, string> = {
  balances: "settles", aggravates: "raises", neutral: "leaves steady",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: B.muted2 }}>{label}</p>
      <p className="m-0 text-sm font-medium" style={{ color: B.ink }}>{value}</p>
    </div>
  );
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const supabase = await createClient();
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, name, cuisine, source_cuisine, diet, is_jain, dish_type, serves, prep_time, cook_time, blurb, tip, badge, tags, ingredients, method, meal_hint, serving_unit, serving_weight_g, kcal, protein_g, carbs_g, fat_g, fibre_g, iron_mg, calcium_mg, vit_b12_mcg, sodium_mg, nutrition_estimated")
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) notFound();

  // The same dish in the family's list carries its Ayurvedic reading
  const { data: dish } = await supabase
    .from("food_items")
    .select("id, name, rasa, virya, vata_effect, pitta_effect, kapha_effect")
    .eq("recipe_id", recipeId)
    .limit(1)
    .maybeSingle();

  const mark = DIET_MARK[recipe.diet] ?? DIET_MARK.veg;
  const macro = (v: number | null, unit: string) => (v == null ? "—" : `${Math.round(v * 10) / 10} ${unit}`);
  const meals = (recipe.meal_hint ?? []).map((m: string) => slotLabel(m));

  return (
    <div className="flex flex-col min-h-screen" style={{ background: B.page }}>
      <header className="px-5 pt-safe pb-6" style={{ background: B.headerGradient }}>
        <PageNav />
        <div className="flex items-center gap-2 mb-1">
          <span aria-label={dietLabel(recipe.diet)} role="img" className="inline-flex items-center justify-center shrink-0"
            style={{ width: 13, height: 13, border: `1.5px solid ${mark}`, borderRadius: 2, background: "rgba(255,255,255,0.85)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: mark }} />
          </span>
          <p className="text-xs" style={{ color: B.gold }}>
            {CUISINES.find((c) => c.key === recipe.cuisine)?.label ?? "Indian"}
            {recipe.source_cuisine && recipe.source_cuisine !== recipe.cuisine ? ` · ${recipe.source_cuisine}` : ""}
            {" · "}{dishTypeOf(recipe.dish_type).label}
          </p>
        </div>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.2 }}>
          {recipe.name}
        </h1>
        {recipe.blurb && (
          <p className="text-sm mt-2" style={{ color: B.onDark }}>{recipe.blurb}</p>
        )}
      </header>

      <main className="flex-1 px-4 py-5 grid gap-4">
        {/* At a glance */}
        <section className="rounded-2xl px-4 py-4 grid grid-cols-3 gap-3"
          style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <Fact label="Serves" value={recipe.serves ?? "—"} />
          <Fact label="Prep" value={recipe.prep_time ?? "—"} />
          <Fact label="Cooking" value={recipe.cook_time ?? "—"} />
        </section>

        {meals.length > 0 && (
          <p className="text-xs -mt-2 px-1" style={{ color: B.muted }}>
            Usually eaten at {meals.join(", ").toLowerCase()}
            {recipe.is_jain ? " · Jain-friendly" : ""}
          </p>
        )}

        {/* Ingredients */}
        <section className="rounded-2xl px-4 py-4 grid gap-2.5"
          style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>What goes in</h2>
          <ul className="grid gap-1.5 m-0 p-0" style={{ listStyle: "none" }}>
            {(recipe.ingredients ?? []).map((line: string, i: number) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: B.ink2 }}>
                <span aria-hidden style={{ color: B.gold }}>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Method */}
        <section className="rounded-2xl px-4 py-4 grid gap-2.5"
          style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>How it&apos;s made</h2>
          <ol className="grid gap-2.5 m-0 p-0" style={{ listStyle: "none" }}>
            {(recipe.method ?? []).map((step: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: B.ink2 }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: B.tint, color: B.violet }}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {recipe.tip && (
            <p className="text-[12.5px] rounded-xl px-3 py-2.5 mt-1" style={{ background: B.goldTint, color: "#7A5A06" }}>
              <b>Tip —</b> {recipe.tip}
            </p>
          )}
        </section>

        {/* Nutrition */}
        <section className="rounded-2xl px-4 py-4 grid gap-3"
          style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>
              One serving
            </h2>
            <p className="text-[11px]" style={{ color: B.muted2 }}>
              {recipe.serving_weight_g ? `About ${Math.round(recipe.serving_weight_g)} g per ${recipe.serving_unit ?? "serving"}` : "Per serving"}
              {recipe.nutrition_estimated ? " · estimated" : ""}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Fact label="Energy" value={recipe.kcal != null ? `${Math.round(recipe.kcal)} kcal` : "—"} />
            <Fact label="Protein" value={macro(recipe.protein_g, "g")} />
            <Fact label="Carbs" value={macro(recipe.carbs_g, "g")} />
            <Fact label="Fat" value={macro(recipe.fat_g, "g")} />
            <Fact label="Fibre" value={macro(recipe.fibre_g, "g")} />
            <Fact label="Iron" value={macro(recipe.iron_mg, "mg")} />
            <Fact label="Calcium" value={macro(recipe.calcium_mg, "mg")} />
            <Fact label="B12" value={macro(recipe.vit_b12_mcg, "mcg")} />
            <Fact label="Sodium" value={macro(recipe.sodium_mg, "mg")} />
          </div>
        </section>

        {/* Ayurveda */}
        {dish?.virya && (
          <section className="rounded-2xl px-4 py-4 grid gap-2"
            style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#B07C12" }}>
              In Ayurveda
            </h2>
            <p className="text-sm" style={{ color: B.ink2 }}>
              {dish.rasa?.length ? <>Tastes: <b>{dish.rasa.join(", ")}</b>. </> : null}
              A <b>{dish.virya}</b> dish. It {EFFECT_WORD[dish.vata_effect] ?? "leaves steady"} Vata,{" "}
              {EFFECT_WORD[dish.pitta_effect] ?? "leaves steady"} Pitta and{" "}
              {EFFECT_WORD[dish.kapha_effect] ?? "leaves steady"} Kapha.
            </p>
          </section>
        )}

        {recipe.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((t: string) => (
              <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: B.tint, color: B.violet }}>{t}</span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-center pb-2" style={{ color: B.muted2 }}>
          Nutrition is for one serving as written. Your own portion is what the Log counts.
        </p>
      </main>
    </div>
  );
}
