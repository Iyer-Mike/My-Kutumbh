"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FamilyDish = {
  id: string;
  name: string;
  category: string | null;
  serving_unit: string | null;
  serving_weight_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  ingredients: string | null;
  preparation: string | null;
  virya: string | null;
  vata_effect: string | null;
  pitta_effect: string | null;
  kapha_effect: string | null;
  needs_review: boolean;
  created_by: string | null;
};

const CATEGORIES = [
  ["grain", "Grains / rice / tiffin"], ["legume", "Dal / sambar"], ["vegetable", "Vegetable / curry"],
  ["fruit", "Fruit"], ["dairy", "Dairy"], ["snack", "Snack"], ["sweet", "Sweet"],
  ["beverage", "Drink"], ["other", "Other"],
] as const;

const UNITS = ["serving", "piece", "bowl", "cup", "glass", "tbsp", "g"];
const EFFECTS = ["balances", "neutral", "aggravates"] as const;

// Nutrition is entered per serving (how people think) and stored per 100 g
// (how the app calculates).
type Draft = {
  name: string; category: string; serving_unit: string; serving_weight_g: string;
  kcal: string; protein: string; carbs: string; fat: string; fiber: string;
  ingredients: string; preparation: string;
  virya: string; vata: string; pitta: string; kapha: string;
};

function perServing(per100: number | null, weight: number) {
  return per100 == null ? "" : String(Math.round((per100 * weight) / 100 * 10) / 10);
}

function toDraft(d: FamilyDish): Draft {
  const unit = d.serving_unit ?? "serving";
  const w = unit === "g" ? 100 : (d.serving_weight_g ?? 100);
  return {
    name: d.name, category: d.category ?? "other", serving_unit: unit,
    serving_weight_g: String(unit === "g" ? 100 : (d.serving_weight_g ?? 100)),
    kcal: perServing(d.calories, w), protein: perServing(d.protein_g, w),
    carbs: perServing(d.carbs_g, w), fat: perServing(d.fat_g, w), fiber: perServing(d.fiber_g, w),
    ingredients: d.ingredients ?? "", preparation: d.preparation ?? "",
    virya: d.virya ?? "", vata: d.vata_effect ?? "neutral", pitta: d.pitta_effect ?? "neutral", kapha: d.kapha_effect ?? "neutral",
  };
}

function per100(v: string, weight: number) {
  const n = parseFloat(v);
  if (!v.trim() || isNaN(n) || weight <= 0) return null;
  return Math.round((n / weight) * 100 * 10) / 10;
}

const inputStyle = { border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" } as const;

export default function FamilyDishesEditor({
  initialDishes, creators,
}: { initialDishes: FamilyDish[]; creators: Record<string, string> }) {
  const supabase = createClient();
  const [dishes, setDishes]   = useState(initialDishes);
  const [openId, setOpenId]   = useState<string | null>(initialDishes.find(d => d.needs_review)?.id ?? null);
  const [draft, setDraft]     = useState<Draft | null>(() => {
    const first = initialDishes.find(d => d.needs_review);
    return first ? toDraft(first) : null;
  });
  const [saving, setSaving]   = useState(false);
  const [notice, setNotice]   = useState<string | null>(null);

  function open(d: FamilyDish) {
    if (openId === d.id) { setOpenId(null); setDraft(null); return; }
    setOpenId(d.id);
    setDraft(toDraft(d));
    setNotice(null);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(prev => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save(d: FamilyDish) {
    if (!draft) return;
    const weight = draft.serving_unit === "g" ? 100 : parseFloat(draft.serving_weight_g);
    if (!draft.name.trim()) { alert("Give the dish a name."); return; }
    if (!weight || weight <= 0) { alert("Enter how many grams one serving weighs."); return; }
    if (!draft.kcal.trim()) { alert("Enter the kcal for one serving — it's what makes the dish count in the dietary chart."); return; }

    setSaving(true);
    const update = {
      name:             draft.name.trim(),
      category:         draft.category,
      serving_unit:     draft.serving_unit,
      serving_weight_g: weight,
      calories:         per100(draft.kcal, weight),
      protein_g:        per100(draft.protein, weight),
      carbs_g:          per100(draft.carbs, weight),
      fat_g:            per100(draft.fat, weight),
      fiber_g:          per100(draft.fiber, weight),
      ingredients:      draft.ingredients.trim() || null,
      preparation:      draft.preparation.trim() || null,
      virya:            draft.virya || null,
      vata_effect:      draft.vata,
      pitta_effect:     draft.pitta,
      kapha_effect:     draft.kapha,
      needs_review:     false,
      updated_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from("food_items").update(update).eq("id", d.id);
    if (error) { setSaving(false); alert(`Couldn't save: ${error.message}`); return; }

    // Fill in kcal on logs that were made before the dish had details
    const { data: filled, error: rpcErr } = await supabase.rpc("apply_family_dish", { dish_id: d.id });
    setSaving(false);

    setDishes(prev => prev.map(x => (x.id === d.id ? { ...x, ...update } : x)));
    setOpenId(null);
    setDraft(null);
    setNotice(
      rpcErr
        ? `Saved “${update.name}”. Past logs couldn't be updated: ${rpcErr.message}`
        : `Saved “${update.name}”${filled ? ` · ${filled} earlier log${filled === 1 ? "" : "s"} now counted` : ""}`,
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
        const w      = unit === "g" ? 100 : (d.serving_weight_g ?? 100);
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
                    : `${kcal ?? "—"} kcal per ${unit === "g" ? "100 g" : unit}${d.ingredients ? " · ingredients ✓" : ""}${d.preparation ? " · prep ✓" : ""}`}
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
                  <label htmlFor={`cat-${d.id}`} className="text-xs" style={{ color: "#8A9085" }}>Category</label>
                  <select id={`cat-${d.id}`} value={draft.category} onChange={e => set("category", e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                    {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* Serving */}
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

                {/* Nutrition per serving */}
                <div>
                  <p className="text-xs mb-1" style={{ color: "#8A9085" }}>
                    Nutrition for one {draft.serving_unit === "g" ? "100 g" : draft.serving_unit}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["kcal", "kcal *"], ["protein", "Protein g"], ["carbs", "Carbs g"],
                      ["fat", "Fat g"], ["fiber", "Fibre g"],
                    ] as const).map(([k, label]) => (
                      <div key={k}>
                        <label htmlFor={`${k}-${d.id}`} className="text-[11px]" style={{ color: "#8A9085" }}>{label}</label>
                        <input id={`${k}-${d.id}`} type="number" min="0" step="0.1" value={draft[k]}
                          onChange={e => set(k, e.target.value)}
                          className="w-full rounded-lg px-2 py-1.5 text-sm" style={inputStyle} />
                      </div>
                    ))}
                  </div>
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
                    placeholder="e.g. pressure-cooked, tempered in coconut oil, low salt"
                    className="w-full mt-1 rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                </div>

                {/* Ayurvedic qualities (optional) */}
                <details className="rounded-xl px-3 py-2" style={{ background: "#F6F5EE" }}>
                  <summary className="text-xs font-semibold cursor-pointer" style={{ color: "#5A6055" }}>
                    Ayurvedic qualities (optional)
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-2">
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
