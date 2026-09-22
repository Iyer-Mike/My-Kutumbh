"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CUISINES, DIETS, DISH_TYPES } from "@/lib/food-taxonomy";

type NutrientCol =
  | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g"
  | "iron_mg" | "calcium_mg" | "vitamin_b12_mcg" | "vitamin_c_mg"
  | "folate_mcg" | "sodium_mg" | "potassium_mg";

export type FamilyDish = {
  id: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  diet: string | null;
  serving_unit: string | null;
  serving_weight_g: number | null;
  ingredients: string | null;
  preparation: string | null;
  rasa: string[] | null;
  guna: string[] | null;
  vipaka: string | null;
  virya: string | null;
  vata_effect: string | null;
  pitta_effect: string | null;
  kapha_effect: string | null;
  needs_review: boolean;
  created_by: string | null;
} & Record<NutrientCol, number | null>;

const UNITS   = ["serving", "plate", "bowl", "katori", "piece", "cup", "glass", "tbsp", "tsp", "g"];
const EFFECTS = ["balances", "neutral", "aggravates"] as const;
const RASAS   = ["sweet", "sour", "salty", "pungent", "bitter", "astringent"] as const;
const GUNAS   = ["heavy", "light", "oily", "dry", "smooth", "rough", "soft", "hard", "liquid", "dense"] as const;

const MAIN: { col: NutrientCol; label: string }[] = [
  { col: "calories", label: "kcal *" }, { col: "protein_g", label: "Protein g" },
  { col: "carbs_g", label: "Carbs g" }, { col: "fat_g", label: "Fat g" }, { col: "fiber_g", label: "Fibre g" },
];
const MICRO: { col: NutrientCol; label: string }[] = [
  { col: "iron_mg", label: "Iron mg" }, { col: "calcium_mg", label: "Calcium mg" },
  { col: "vitamin_b12_mcg", label: "B12 mcg" }, { col: "vitamin_c_mg", label: "Vit C mg" },
  { col: "folate_mcg", label: "Folate mcg" }, { col: "sodium_mg", label: "Sodium mg" },
  { col: "potassium_mg", label: "Potassium mg" },
];
const ALL_NUTRIENTS = [...MAIN, ...MICRO];

// Nutrition is entered per serving (how people think) and stored per 100 g
// (how the app calculates).
type Draft = {
  name: string; category: string; cuisine: string; diet: string; serving_unit: string; serving_weight_g: string;
  nutrients: Record<NutrientCol, string>;
  ingredients: string; preparation: string;
  rasa: string[]; guna: string[]; vipaka: string;
  virya: string; vata: string; pitta: string; kapha: string;
};

type Estimate = {
  category: string; cuisine: string; diet: string; serving_unit: string; serving_weight_g: number;
  per_100g: {
    kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
    iron_mg: number; calcium_mg: number; vitamin_b12_mcg: number; vitamin_c_mg: number;
    folate_mcg: number; sodium_mg: number; potassium_mg: number;
  };
  rasa: string[]; guna: string[]; vipaka: string; virya: string;
  vata_effect: string; pitta_effect: string; kapha_effect: string; note: string;
};

function round1(n: number) { return Math.round(n * 10) / 10; }
function perServing(per100: number | null, weight: number) {
  return per100 == null ? "" : String(round1((per100 * weight) / 100));
}
function weightOf(unit: string, w: number | null | string) {
  return unit === "g" ? 100 : (typeof w === "string" ? parseFloat(w) : (w ?? 100));
}

function toDraft(d: FamilyDish): Draft {
  const unit = d.serving_unit ?? "serving";
  const w = weightOf(unit, d.serving_weight_g);
  const nutrients = Object.fromEntries(ALL_NUTRIENTS.map(n => [n.col, perServing(d[n.col], w)])) as Record<NutrientCol, string>;
  return {
    name: d.name, category: d.category ?? "extras", cuisine: d.cuisine ?? "south_indian", diet: d.diet ?? "veg", serving_unit: unit, serving_weight_g: String(w),
    nutrients,
    ingredients: d.ingredients ?? "", preparation: d.preparation ?? "",
    rasa: d.rasa ?? [], guna: d.guna ?? [], vipaka: d.vipaka ?? "",
    virya: d.virya ?? "", vata: d.vata_effect ?? "neutral", pitta: d.pitta_effect ?? "neutral", kapha: d.kapha_effect ?? "neutral",
  };
}

function per100(v: string, weight: number) {
  const n = parseFloat(v);
  if (!v.trim() || isNaN(n) || weight <= 0) return null;
  return round1((n / weight) * 100);
}

const inputStyle = { border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" } as const;

export default function FamilyDishesEditor({
  initialDishes, creators,
}: { initialDishes: FamilyDish[]; creators: Record<string, string> }) {
  const supabase = createClient();
  const firstPending = initialDishes.find(d => d.needs_review) ?? null;
  const [dishes, setDishes]     = useState(initialDishes);
  const [openId, setOpenId]     = useState<string | null>(firstPending?.id ?? null);
  const [draft, setDraft]       = useState<Draft | null>(firstPending ? toDraft(firstPending) : null);
  const [saving, setSaving]     = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [aiNote, setAiNote]     = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  function open(d: FamilyDish) {
    setAiNote(null);
    setNotice(null);
    if (openId === d.id) { setOpenId(null); setDraft(null); return; }
    setOpenId(d.id);
    setDraft(toDraft(d));
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(prev => (prev ? { ...prev, [k]: v } : prev));
  }

  function setNutrient(col: NutrientCol, v: string) {
    setDraft(prev => (prev ? { ...prev, nutrients: { ...prev.nutrients, [col]: v } } : prev));
  }

  function toggleIn(k: "rasa" | "guna", v: string) {
    setDraft(prev => {
      if (!prev) return prev;
      const has = prev[k].includes(v);
      return { ...prev, [k]: has ? prev[k].filter(x => x !== v) : [...prev[k], v] };
    });
  }

  async function fillWithAI() {
    if (!draft) return;
    if (!draft.ingredients.trim()) {
      if (!confirm("No ingredients entered yet. The estimate will be rougher without them. Continue anyway?")) return;
    }
    setEstimating(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/estimate-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, ingredients: draft.ingredients, preparation: draft.preparation }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Couldn't estimate this dish."); return; }
      const e = data as Estimate;
      const w = weightOf(e.serving_unit, e.serving_weight_g);
      const p = e.per_100g;
      const fromAi: Record<NutrientCol, number> = {
        calories: p.kcal, protein_g: p.protein_g, carbs_g: p.carbs_g, fat_g: p.fat_g, fiber_g: p.fiber_g,
        iron_mg: p.iron_mg, calcium_mg: p.calcium_mg, vitamin_b12_mcg: p.vitamin_b12_mcg,
        vitamin_c_mg: p.vitamin_c_mg, folate_mcg: p.folate_mcg, sodium_mg: p.sodium_mg, potassium_mg: p.potassium_mg,
      };
      setDraft(prev => prev && ({
        ...prev,
        category: e.category,
        cuisine: e.cuisine,
        diet: e.diet,
        serving_unit: e.serving_unit,
        serving_weight_g: String(w),
        nutrients: Object.fromEntries(ALL_NUTRIENTS.map(n => [n.col, perServing(fromAi[n.col], w)])) as Record<NutrientCol, string>,
        rasa: e.rasa, guna: e.guna, vipaka: e.vipaka, virya: e.virya,
        vata: e.vata_effect, pitta: e.pitta_effect, kapha: e.kapha_effect,
      }));
      setAiNote(e.note);
    } catch {
      alert("Couldn't reach the AI service. Check your connection and try again.");
    } finally {
      setEstimating(false);
    }
  }

  async function save(d: FamilyDish) {
    if (!draft) return;
    const weight = weightOf(draft.serving_unit, draft.serving_weight_g);
    if (!draft.name.trim()) { alert("Give the dish a name."); return; }
    if (!weight || weight <= 0) { alert("Enter how many grams one serving weighs."); return; }
    if (!draft.nutrients.calories.trim()) {
      alert("Enter the kcal for one serving — it's what makes the dish count in the dietary chart.");
      return;
    }

    setSaving(true);
    const nutrientCols = Object.fromEntries(
      ALL_NUTRIENTS.map(n => [n.col, per100(draft.nutrients[n.col], weight)]),
    ) as Record<NutrientCol, number | null>;
    const update = {
      name:             draft.name.trim(),
      category:         draft.category,
      cuisine:          draft.cuisine,
      diet:             draft.diet,
      serving_unit:     draft.serving_unit,
      serving_weight_g: weight,
      ...nutrientCols,
      ingredients:      draft.ingredients.trim() || null,
      preparation:      draft.preparation.trim() || null,
      rasa:             draft.rasa.length ? draft.rasa : null,
      guna:             draft.guna.length ? draft.guna : null,
      vipaka:           draft.vipaka || null,
      virya:            draft.virya || null,
      vata_effect:      draft.vata,
      pitta_effect:     draft.pitta,
      kapha_effect:     draft.kapha,
      needs_review:     false,
      updated_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from("food_items").update(update).eq("id", d.id);
    if (error) { setSaving(false); alert(`Couldn't save: ${error.message}`); return; }

    // Replace estimated kcal on logs made before the dish had details
    const { data: filled, error: rpcErr } = await supabase.rpc("apply_family_dish", { dish_id: d.id });
    setSaving(false);

    setDishes(prev => prev.map(x => (x.id === d.id ? { ...x, ...update } : x)));
    setOpenId(null);
    setDraft(null);
    setAiNote(null);
    setNotice(
      rpcErr
        ? `Saved “${update.name}”. Earlier logs couldn't be updated: ${rpcErr.message}`
        : `Saved “${update.name}”${filled ? ` · ${filled} earlier log${filled === 1 ? "" : "s"} updated with exact values` : ""}`,
    );
  }

  if (dishes.length === 0) {
    return (
      <div className="text-center pt-10">
        <p className="text-3xl mb-3">🍲</p>
        <p className="text-sm font-medium" style={{ color: "#1C201C" }}>No family dishes yet</p>
        <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "#8A9085" }}>
          When anyone plans or logs a dish that isn&apos;t in the food list, it appears here for you to complete.
        </p>
      </div>
    );
  }

  const chip = (on: boolean) => on
    ? { background: "#1C2B1C", color: "#fff", border: "1px solid #1C2B1C" }
    : { background: "#fff", color: "#5A6055", border: "1px solid #E2E1D8" };

  return (
    <div className="space-y-3">
      {notice && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EAF2E8", color: "#2E5A28", border: "1px solid #C5DFC2" }}>
          {notice}
        </div>
      )}

      {dishes.map(d => {
        const isOpen = openId === d.id && draft;
        const unit   = d.serving_unit ?? "serving";
        const w      = weightOf(unit, d.serving_weight_g);
        const kcal   = d.calories != null ? Math.round((d.calories * w) / 100) : null;
        return (
          <div key={d.id} className="rounded-2xl overflow-hidden"
            style={{ background: "#fff", border: `1.5px solid ${d.needs_review ? "#E4B774" : "#E2E1D8"}` }}>
            <button onClick={() => open(d)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#1C201C" }}>{d.name}</p>
                <p className="text-xs mt-0.5" style={{ color: d.needs_review ? "#A5661A" : "#8A9085" }}>
                  {d.needs_review
                    ? `Needs details · added by ${d.created_by ? creators[d.created_by] ?? "Family" : "Family"}`
                    : `${kcal ?? "—"} kcal per ${unit === "g" ? "100 g" : unit}${d.iron_mg != null ? " · minerals ✓" : ""}${d.rasa?.length ? " · Ayurveda ✓" : ""}`}
                </p>
              </div>
              <span className="text-xs font-semibold flex-shrink-0 px-2.5 py-1 rounded-full"
                style={d.needs_review ? { background: "#FBEFD9", color: "#A5661A" } : { background: "#EAF2E8", color: "#4A7C44" }}>
                {isOpen ? "Close" : d.needs_review ? "Complete" : "Edit"}
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #F0EFE8" }}>
                <div className="pt-3">
                  <label htmlFor={`name-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Dish name</label>
                  <input id={`name-${d.id}`} value={draft.name} onChange={e => set("name", e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                </div>

                <div>
                  <label htmlFor={`ing-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Ingredients</label>
                  <textarea id={`ing-${d.id}`} rows={2} value={draft.ingredients} onChange={e => set("ingredients", e.target.value)}
                    placeholder="e.g. toor dal, tamarind, drumstick, sambar powder, coconut oil"
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                </div>

                <div>
                  <label htmlFor={`prep-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Preparation method</label>
                  <textarea id={`prep-${d.id}`} rows={2} value={draft.preparation} onChange={e => set("preparation", e.target.value)}
                    placeholder="e.g. pressure-cooked, tempered in 1 tbsp coconut oil, low salt"
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                </div>

                {/* AI estimate from the ingredients + method above */}
                <div className="rounded-xl px-3 py-2.5" style={{ background: "#F3F0FB", border: "1px solid #DDD5F3" }}>
                  <button onClick={fillWithAI} disabled={estimating || !draft.name.trim()}
                    className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#fff", color: "#4B3B8C", border: "1px solid #C9BDEB" }}>
                    {estimating ? "Estimating…" : "✨ Fill with AI"}
                  </button>
                  <p className="text-[11px] mt-1.5" style={{ color: "#6E6390" }}>
                    {aiNote
                      ? <>AI estimate filled in below — review before saving. <i>{aiNote}</i></>
                      : "Uses the ingredients and method above to suggest nutrition and Ayurvedic qualities. You review before saving."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`cuisine-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Cuisine</label>
                    <select id={`cuisine-${d.id}`} value={draft.cuisine} onChange={e => set("cuisine", e.target.value)}
                      className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                      {CUISINES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`diet-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Diet</label>
                    <select id={`diet-${d.id}`} value={draft.diet} onChange={e => set("diet", e.target.value)}
                      className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                      {DIETS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`cat-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Dish type</label>
                  <select id={`cat-${d.id}`} value={draft.category} onChange={e => set("category", e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                    {DISH_TYPES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`unit-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>One serving is a…</label>
                    <select id={`unit-${d.id}`} value={draft.serving_unit} onChange={e => set("serving_unit", e.target.value)}
                      className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                      {UNITS.map(u => <option key={u} value={u}>{u === "g" ? "100 g" : u}</option>)}
                    </select>
                  </div>
                  {draft.serving_unit !== "g" && (
                    <div>
                      <label htmlFor={`w-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>which weighs (g)</label>
                      <input id={`w-${d.id}`} type="number" min="1" value={draft.serving_weight_g}
                        onChange={e => set("serving_weight_g", e.target.value)}
                        className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs mb-1" style={{ color: "#8A9085" }}>
                    Nutrition for one {draft.serving_unit === "g" ? "100 g" : draft.serving_unit}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {MAIN.map(({ col, label }) => (
                      <div key={col}>
                        <label htmlFor={`${col}-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>{label}</label>
                        <input id={`${col}-${d.id}`} type="number" min="0" step="0.1" value={draft.nutrients[col]}
                          onChange={e => setNutrient(col, e.target.value)}
                          className="w-full rounded-lg px-2 py-1.5 text-sm" style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl px-3 py-2" style={{ background: "#F6F5EE" }}>
                  <summary className="text-xs font-semibold cursor-pointer" style={{ color: "#5A6055" }}>
                    Minerals &amp; vitamins, per serving (optional)
                  </summary>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {MICRO.map(({ col, label }) => (
                      <div key={col}>
                        <label htmlFor={`${col}-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>{label}</label>
                        <input id={`${col}-${d.id}`} type="number" min="0" step="0.1" value={draft.nutrients[col]}
                          onChange={e => setNutrient(col, e.target.value)}
                          className="w-full rounded-lg px-2 py-1.5 text-sm" style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </details>

                <details className="rounded-xl px-3 py-2" style={{ background: "#F6F5EE" }}>
                  <summary className="text-xs font-semibold cursor-pointer" style={{ color: "#5A6055" }}>
                    Ayurvedic qualities (optional)
                  </summary>
                  <div className="space-y-2.5 mt-2">
                    <div>
                      <p className="text-[11px] mb-1" style={{ color: "#8A9085" }}>Rasa (tastes)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {RASAS.map(r => (
                          <button key={r} type="button" onClick={() => toggleIn("rasa", r)}
                            className="px-2.5 py-1 rounded-full text-xs capitalize" style={chip(draft.rasa.includes(r))}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] mb-1" style={{ color: "#8A9085" }}>Guna (qualities)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {GUNAS.map(g => (
                          <button key={g} type="button" onClick={() => toggleIn("guna", g)}
                            className="px-2.5 py-1 rounded-full text-xs capitalize" style={chip(draft.guna.includes(g))}>{g}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`vipaka-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>Vipaka</label>
                        <select id={`vipaka-${d.id}`} value={draft.vipaka} onChange={e => set("vipaka", e.target.value)}
                          className="w-full rounded-lg px-2 py-1.5 text-xs" style={inputStyle}>
                          <option value="">—</option>
                          <option value="sweet">Sweet</option>
                          <option value="sour">Sour</option>
                          <option value="pungent">Pungent</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`virya-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>Virya</label>
                        <select id={`virya-${d.id}`} value={draft.virya} onChange={e => set("virya", e.target.value)}
                          className="w-full rounded-lg px-2 py-1.5 text-xs" style={inputStyle}>
                          <option value="">—</option>
                          <option value="heating">Heating</option>
                          <option value="cooling">Cooling</option>
                          <option value="neutral">Neutral</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {([["vata", "Vata"], ["pitta", "Pitta"], ["kapha", "Kapha"]] as const).map(([k, label]) => (
                        <div key={k}>
                          <label htmlFor={`${k}-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>{label}</label>
                          <select id={`${k}-${d.id}`} value={draft[k]} onChange={e => set(k, e.target.value)}
                            className="w-full rounded-lg px-2 py-1.5 text-xs" style={inputStyle}>
                            {EFFECTS.map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                <button onClick={() => save(d)} disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#1C2B1C" }}>
                  {saving ? "Saving…" : "Save dish ✓"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
