import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageNav from "@/components/PageNav";
import { BRAND as B, FAMILY, look } from "@/lib/brand";
import { CUISINES, dietLabel, dishTypeOf } from "@/lib/food-taxonomy";
import { slotLabel } from "@/lib/meal-slots";
import PrintRecipe from "@/components/PrintRecipe";
import RecipeApproval from "@/components/RecipeApproval";
import CopyRecipeButton from "@/components/CopyRecipeButton";
import { familyOf } from "@/lib/family";
import { isLang, langOf } from "@/lib/languages";
import RecipeLanguageSelect from "@/components/RecipeLanguageSelect";
import TranslationEditor from "@/components/TranslationEditor";

const DIET_MARK: Record<string, string> = { vegan: "#2F7D32", veg: "#2F7D32", egg: "#C98A0B", nonveg: "#A23A1E" };

// What one serve is, said the way the dish is eaten: a bowl of sambar, a piece of chapati
const UNIT_PLURAL: Record<string, string> = { bowl: "bowls", plate: "plates", piece: "pieces", glass: "glasses", cup: "cups", katori: "katoris", tbsp: "tbsp" };
const unitWord = (u: string | null) => (u && u !== "serving" ? u : "portion");

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

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lang = isLang(langParam) ? langParam : null;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const supabase = await createClient();
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, name, cuisine, source_cuisine, diet, is_jain, dish_type, serves, prep_time, cook_time, blurb, tip, badge, tags, ingredients, method, meal_hint, serving_unit, serving_weight_g, kcal, protein_g, carbs_g, fat_g, fibre_g, iron_mg, calcium_mg, vit_b12_mcg, sodium_mg, nutrition_estimated, status, kutumbh_id, created_by, in_bucket, copied_from")
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

  // The recipe in the chosen language, if it has been written yet
  type Tr = { name: string; blurb: string | null; ingredients: string[]; method: string[]; status: string };
  let tr: Tr | null = null;
  if (lang) {
    const { data } = await supabase.from("recipe_translations").select("name, blurb, ingredients, method, status").eq("recipe_id", recipeId).eq("lang", lang).maybeSingle();
    tr = (data as Tr | null) ?? null;
  }
  const L = langOf(lang);
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const viewerIsKey = viewer ? (await familyOf(supabase, viewer.id)).isPrime : false;
  const shown = {
    name: tr?.name ?? recipe.name,
    blurb: tr ? tr.blurb : recipe.blurb,
    ingredients: tr && tr.ingredients.length ? tr.ingredients : (recipe.ingredients ?? []),
    method: tr && tr.method.length ? tr.method : (recipe.method ?? []),
  };

  // A family recipe waits for the Key Member before the family sees it
  const waiting = recipe.status === "draft";
  let canApprove = false;
  let canEdit = false;
  let canCopy = false;
  if (!recipe.kutumbh_id) {
    // A shared recipe is fixed; the Key Member can make the family's own version of it
    const { data: { user } } = await supabase.auth.getUser();
    canCopy = user ? (await familyOf(supabase, user.id)).isPrime : false;
  }
  if (recipe.kutumbh_id) {
    const { data: { user } } = await supabase.auth.getUser();
    canApprove = user ? (await familyOf(supabase, user.id)).isPrime : false;
    canEdit = canApprove || (waiting && !!user && recipe.created_by === user.id);
  }

  // A family version points back to the recipe it came from; the original lists the family's versions
  let original: { id: number; name: string } | null = null;
  let variants: { id: number; name: string }[] = [];
  if (recipe.copied_from) {
    const { data: o } = await supabase.from("recipes").select("id, name").eq("id", recipe.copied_from).maybeSingle();
    original = o;
  } else if (!recipe.kutumbh_id) {
    const { data: v } = await supabase.from("recipes").select("id, name").eq("copied_from", recipeId).eq("status", "published").order("name");
    variants = v ?? [];
  }

  const mark = DIET_MARK[recipe.diet] ?? DIET_MARK.veg;
  const macro = (v: number | null, unit: string) => (v == null ? "—" : `${Math.round(v * 10) / 10} ${unit}`);
  const unit = unitWord(recipe.serving_unit);
  const makes = recipe.serves
    ? `${recipe.serves} ${Number(recipe.serves) === 1 ? unit : (UNIT_PLURAL[unit] ?? `${unit}s`)}`
    : "—";
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
            {recipe.kutumbh_id ? " · Family recipe" : ""}
          </p>
        </div>
        <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.2 }}>
          {shown.name}
        </h1>
        {tr && <p className="m-0 mt-1 text-xs" style={{ color: B.gold }}>{recipe.name}</p>}
        {original && (
          <p className="text-xs mt-1.5" style={{ color: B.gold }}>
            Variant of <Link href={`/recipes/${original.id}`} className="underline">{original.name}</Link>
          </p>
        )}
        {shown.blurb && (
          <p lang={tr ? lang ?? undefined : undefined} className="text-sm mt-2" style={{ color: B.onDark }}>{shown.blurb}</p>
        )}
        <div className="mt-3"><RecipeLanguageSelect current={lang} /></div>
      </header>

      <main className="flex-1 px-4 py-5 grid gap-4">
        {waiting && <RecipeApproval recipeId={recipe.id} canApprove={canApprove} />}
        {L && !tr && (
          <p className="text-xs rounded-xl px-3 py-2 m-0" style={{ background: B.goldTint, color: B.goldInk }}>
            Not yet written in {L.name} · showing English.
          </p>
        )}
        {L && tr && tr.status !== "checked" && (
          <p className="text-xs rounded-xl px-3 py-2 m-0" style={{ background: B.goldTint, color: B.goldInk }}>
            Draft translation · not yet checked.
          </p>
        )}
        {L && tr && viewerIsKey && viewer && (
          <TranslationEditor recipeId={recipe.id} lang={lang!} userId={viewer.id} t={tr} />
        )}

        {/* At a glance */}
        <section className="rounded-2xl px-4 py-4 grid grid-cols-3 gap-3"
          style={look(FAMILY.amber)}>
          <Fact label="Makes" value={makes} />
          <Fact label="Prep" value={recipe.prep_time ?? "—"} />
          <Fact label="Cooking" value={recipe.cook_time ?? "—"} />
        </section>

        {variants.length > 0 && (
          <section className="rounded-2xl px-4 py-3 grid gap-1.5" style={look(FAMILY.violet)}>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: B.muted2 }}>Your family&apos;s versions</p>
            {variants.map((v) => (
              <Link key={v.id} href={`/recipes/${v.id}`} className="text-sm font-semibold" style={{ color: B.violet }}>{v.name} →</Link>
            ))}
          </section>
        )}

        {meals.length > 0 && (
          <p className="text-xs -mt-2 px-1" style={{ color: B.muted }}>
            Usually eaten at {meals.join(", ").toLowerCase()}
            {recipe.is_jain ? " · Jain-friendly" : ""}
          </p>
        )}

        {/* Ingredients */}
        <section className="rounded-2xl px-4 py-4 grid gap-2.5"
          style={look(FAMILY.blue)}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>What goes in</h2>
          <ul className="grid gap-1.5 m-0 p-0" style={{ listStyle: "none" }}>
            {shown.ingredients.map((line: string, i: number) => (
              <li key={i} lang={tr ? lang ?? undefined : undefined} className="flex gap-2.5 text-sm" style={{ color: B.ink2 }}>
                <span aria-hidden style={{ color: B.gold }}>•</span>
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Method */}
        <section className="rounded-2xl px-4 py-4 grid gap-2.5"
          style={look(FAMILY.blue)}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>How it&apos;s made</h2>
          <ol className="grid gap-2.5 m-0 p-0" style={{ listStyle: "none" }}>
            {shown.method.map((step: string, i: number) => (
              <li key={i} lang={tr ? lang ?? undefined : undefined} className="flex gap-3 text-sm leading-relaxed" style={{ color: B.ink2 }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: B.tint, color: B.violet }}>{i + 1}</span>
                <span className="min-w-0">{step}</span>
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
          style={look(FAMILY.amber)}>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>
              Per {unit}
            </h2>
            <p className="text-[11px]" style={{ color: B.muted2 }}>
              {[recipe.serving_weight_g ? `About ${Math.round(recipe.serving_weight_g)} g` : null, recipe.nutrition_estimated ? "estimated" : null].filter(Boolean).join(" · ")}
            </p>
            {recipe.nutrition_estimated && (
              <p className="text-[11px] mt-0.5" style={{ color: B.muted2 }}>
                AI estimated as per IFCT tables and reviewed by Key Member.
              </p>
            )}
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
            style={look(FAMILY.violet)}>
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

        {canCopy && <CopyRecipeButton recipeId={recipe.id} recipeName={recipe.name} />}
        {canEdit && (
          <Link href={`/recipes/${recipe.id}/edit`} data-print-hide
            className="w-full py-3 rounded-2xl text-sm font-semibold text-center"
            style={{ background: B.card, color: B.violet, border: `1.5px solid ${B.cardEdge}` }}>
            ✎ Edit this recipe
          </Link>
        )}
        {recipe.in_bucket && (
          <p data-print-hide className="text-[11px] text-center" style={{ color: B.muted2 }}>
            In the nutrition bucket · estimate pending.
          </p>
        )}

        <PrintRecipe name={shown.name} />

        <p className="text-[11px] text-center pb-2" style={{ color: B.muted2 }}>
          Values are per {unit} · The Log counts your portion.
        </p>
      </main>
    </div>
  );
}
