"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { defaultPoolName } from "@/lib/meal-slots";
import { DISH_TYPES, dishTypeOf, type DishType } from "@/lib/food-taxonomy";
import FoodFilterBar, { applyFoodFilter, dietOr, sortForSlot, useMyFoodFilter, DietMark } from "@/components/FoodFilterBar";
import { todayLocal } from "@/lib/dates";

// The Plan is the family menu: dish names only. Each member sets their own
// portion when logging, and nutrition is worked out from that.
export type PlanItem = {
  id: string;
  user_id: string;
  food_name: string;
  needs_review: boolean;
  category: string | null;
  serving_unit: string | null;
  kcal_per_serving: number | null;
};

type FoodSuggestion = {
  id: string;
  name: string;
  category: string | null;
  calories: number | null;
  serving_weight_g: number | null;
  serving_unit: string | null;
  kutumbh_id: string | null;
  needs_review: boolean | null;
  diet?: string | null;
  meal_hint?: string[] | null;
};

const SUGGEST_COLS = "id, name, category, diet, meal_hint, calories, serving_weight_g, serving_unit, kutumbh_id, needs_review";

type Props = {
  slotKey: string;
  name: string;
  icon: string;
  time: string;
  userId: string;
  kutumbhId: string | null;
  initialItems: PlanItem[];
  initialPoolName: string | null;
  memberNames: Record<string, string>;
};

function perServingKcal(f: { calories: number | null; serving_weight_g: number | null; serving_unit: string | null }) {
  if (f.calories == null) return null;
  const w = f.serving_unit === "g" ? 100 : (f.serving_weight_g ?? 100);
  return Math.round((f.calories * w) / 100);
}

export function servingHint(item: Pick<PlanItem, "needs_review" | "category" | "serving_unit" | "kcal_per_serving">) {
  const unit = item.serving_unit === "g" ? "100 g" : (item.serving_unit ?? "serving");
  if (item.kcal_per_serving != null) return `${item.kcal_per_serving} kcal / ${unit}`;
  if (item.needs_review) return `~${dishTypeOf(item.category).kcalPerServing} kcal / ${unit} est.`;
  return null;
}

export default function PlanSlotCard({
  slotKey, name, icon, time, userId, kutumbhId, initialItems, initialPoolName, memberNames,
}: Props) {
  const supabase = createClient();
  const [items, setItems]               = useState<PlanItem[]>(initialItems);
  const [adding, setAdding]             = useState(false);
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState<FoodSuggestion[]>([]);
  const [searched, setSearched]         = useState("");
  const [chosen, setChosen]             = useState<FoodSuggestion[]>([]);
  const [newCategory, setNewCategory]   = useState<DishType | null>(null);
  const [filter, setFilter]             = useMyFoodFilter();
  const [browse, setBrowse]             = useState<FoodSuggestion[]>([]);
  const [saving, setSaving]             = useState(false);

  const [poolName, setPoolName]   = useState(initialPoolName ?? defaultPoolName(slotKey));
  const [renaming, setRenaming]   = useState(false);
  const [draftName, setDraftName] = useState(poolName);

  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search: shared catalogue + this family's dishes (via RLS)
  useEffect(() => {
    if (!query.trim()) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("food_items")
        .select(SUGGEST_COLS)
        .ilike("name", `%${q}%`)
        .or(dietOr(filter.diet))
        .order("name")
        .limit(12);
      setSuggestions(sortForSlot((data ?? []) as FoodSuggestion[], slotKey));
      setSearched(q);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter.diet]);

  // Browse by meal → cuisine → diet → dish type while nothing is typed
  useEffect(() => {
    if (!adding || query.trim()) return;
    let cancelled = false;
    (async () => {
      const q = applyFoodFilter(
        supabase.from("food_items").select(SUGGEST_COLS).order("name").limit(400), filter, false, slotKey);
      const { data } = await q;
      if (!cancelled) setBrowse(sortForSlot((data ?? []) as FoodSuggestion[], slotKey));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, query, filter]);

  function resetPicker() {
    setQuery(""); setSuggestions([]); setSearched("");
    setChosen([]); setNewCategory(null);
  }

  function openAdd() {
    setAdding(true);
    resetPicker();
    setFilter(f => ({ ...f, type: "", mealOnly: true }));
  }

  function cancelAdd() {
    setAdding(false);
    resetPicker();
  }

  function toggleChosen(f: FoodSuggestion) {
    setChosen(prev => prev.some(c => c.id === f.id) ? prev.filter(c => c.id !== f.id) : [...prev, f]);
  }

  const onMenu        = new Set(items.map(i => i.food_name.toLowerCase()));
  const typed         = query.trim();
  const exactMatch    = suggestions.find(s => s.name.toLowerCase() === typed.toLowerCase()) ?? null;
  const isNewDish     = !!typed && !exactMatch && searched === typed;
  const newDishReady  = isNewDish && (!kutumbhId || !!newCategory);
  const addCount      = chosen.length + (newDishReady ? 1 : 0);

  // New dish → a Family Dish (family-only), awaiting the Prime Member's details
  async function createFamilyDish(dishName: string, category: DishType) {
    const d = dishTypeOf(category);
    const { data, error } = await supabase
      .from("food_items")
      .insert({
        name: dishName, kutumbh_id: kutumbhId, created_by: userId, needs_review: true,
        category, serving_unit: d.unit, serving_weight_g: d.servingG, is_south_indian: true,
        cuisine: filter.cuisine === "indian" || filter.cuisine === "all" ? null : filter.cuisine,
        meal_hint: [slotKey],
      })
      .select(SUGGEST_COLS)
      .single();
    if (error) { alert(`Couldn't add the dish: ${error.message}`); return null; }
    return data as FoodSuggestion;
  }

  // Everything ticked (plus a new dish, if one was typed) goes on the menu in one go
  async function addChosen() {
    if (!addCount || saving) return;
    setSaving(true);

    const foods: (FoodSuggestion | null)[] = [...chosen];
    if (newDishReady) {
      if (kutumbhId && newCategory) {
        const made = await createFamilyDish(typed, newCategory);
        if (!made) { setSaving(false); return; }
        foods.push(made);
      } else {
        foods.push(null);                     // no Kutumbh: plan it by name only
      }
    }

    const rows = foods.map(food => ({
      user_id:       userId,
      kutumbh_id:    kutumbhId ?? null,
      planned_date:  todayLocal(),
      meal_slot:     slotKey,
      food_name:     food?.name ?? typed,
      quantity_g:    1,
      quantity_unit: food?.serving_unit ?? "serving",
      food_item_id:  food?.id ?? null,
    }));
    const { data, error } = await supabase.from("meal_plans").insert(rows).select("id, user_id, food_name, food_item_id");
    setSaving(false);
    if (error || !data) { alert(`Couldn't add to the menu: ${error?.message ?? "unknown error"}`); return; }

    const byId = new Map(foods.filter((f): f is FoodSuggestion => !!f).map(f => [f.id, f]));
    setItems(prev => [...prev, ...data.map(d => {
      const food = d.food_item_id ? byId.get(d.food_item_id) : undefined;
      return {
        id: d.id, user_id: d.user_id, food_name: d.food_name,
        needs_review:     !!food?.needs_review,
        category:         food?.category ?? null,
        serving_unit:     food?.serving_unit ?? null,
        kcal_per_serving: food ? perServingKcal(food) : null,
      };
    })]);
    // Stay open so more dishes can be added straight away
    resetPicker();
  }

  // One tickable dish row, used by both the browse list and the search results
  function dishRow(s: FoodSuggestion, i: number) {
    const k = perServingKcal(s);
    const isOn = chosen.some(c => c.id === s.id);
    const already = onMenu.has(s.name.toLowerCase());
    return (
      <button key={s.id} type="button" disabled={already} onClick={() => toggleChosen(s)}
        aria-pressed={isOn}
        className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 disabled:opacity-50"
        style={{ borderTop: i > 0 ? "1px solid #F0EAFA" : undefined, color: "#241C33", background: isOn ? "#E7DCF7" : undefined }}>
        <span className="min-w-0 flex items-center gap-2">
          <span className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
            style={{ background: isOn ? "#6B46B8" : "#fff", border: `2px solid ${isOn ? "#6B46B8" : "#CBBDE4"}` }}>
            {isOn && (
              <svg width="8" height="7" viewBox="0 0 10 8" fill="none" aria-hidden>
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span aria-hidden className="shrink-0">{dishTypeOf(s.category).icon}</span>
          <DietMark diet={s.diet} />
          <span className="truncate">{s.name}</span>
          {s.kutumbh_id && <span className="shrink-0 text-[10px] font-semibold" style={{ color: "#8A5A06" }}>FAMILY</span>}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "#6A6180" }}>
          {already ? "on menu" : k != null ? `${k} kcal / ${s.serving_unit === "g" ? "100 g" : (s.serving_unit ?? "serving")}` : ""}
        </span>
      </button>
    );
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("meal_plans").delete().eq("id", id);
    if (error) { alert(`Couldn't remove: ${error.message}`); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function savePoolName() {
    const next = draftName.trim();
    if (!next || !kutumbhId) { setRenaming(false); return; }
    const { error } = await supabase
      .from("meal_pools")
      .upsert(
        {
          kutumbh_id: kutumbhId, planned_date: todayLocal(), meal_slot: slotKey,
          name: next, updated_by: userId, updated_at: new Date().toISOString(),
        },
        { onConflict: "kutumbh_id,planned_date,meal_slot" },
      );
    if (error) { alert(`Couldn't rename: ${error.message}`); return; }
    setPoolName(next);
    setRenaming(false);
  }

  const hasItems = items.length > 0;
  const planners = [...new Set(items.map(i => memberNames[i.user_id] ?? "Family"))];

  return (
    <div
      className="rounded-2xl overflow-visible mb-3"
      style={{ background: "#FAF7FE", border: "1px solid #E0D4F2", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Slot header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: hasItems ? "#E7DCF7" : "#F0EAFA" }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm" style={{ color: "#241C33" }}>{name}</p>
            <p className="text-xs mt-0.5" style={{ color: hasItems ? "#6B46B8" : "#6A6180" }}>
              {hasItems ? `${items.length} dish${items.length > 1 ? "es" : ""} on the menu` : `${time} · Nothing planned`}
            </p>
          </div>
        </div>
        <button
          onClick={adding ? cancelAdd : openAdd}
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: adding ? "#241238" : "#E7DCF7", color: adding ? "#fff" : "#6B46B8" }}
          aria-label={adding ? "Done adding" : "Add dish"}
        >
          {adding ? "✓" : "+"}
        </button>
      </div>

      {/* Menu name + who planned it */}
      {hasItems && kutumbhId && (
        <div className="px-4 pb-2 -mt-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") savePoolName(); if (e.key === "Escape") setRenaming(false); }}
                autoFocus
                maxLength={40}
                aria-label="Menu name"
                className="flex-1 rounded-lg px-2 py-1 text-xs"
                style={{ border: "1.5px solid #6B46B8", background: "#FAF7FE", color: "#241C33", outline: "none" }}
              />
              <button onClick={savePoolName} className="text-xs font-semibold" style={{ color: "#6B46B8" }}>Save</button>
              <button onClick={() => setRenaming(false)} className="text-xs" style={{ color: "#6A6180" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setDraftName(poolName); setRenaming(true); }} className="text-left" aria-label="Rename this menu">
              <span className="text-xs font-semibold" style={{ color: "#241238" }}>{poolName}</span>
              <span className="text-xs" style={{ color: "#6A6180" }}> · planned by {planners.join(", ")} </span>
              <span className="text-xs" style={{ color: "#6B46B8" }}>✎</span>
            </button>
          )}
        </div>
      )}

      {/* Menu items */}
      {hasItems && (
        <div style={{ borderTop: "1px solid #E7DCF7" }}>
          {items.map((item, i) => {
            const mine = item.user_id === userId;
            const hint = servingHint(item);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid #F0EAFA" : undefined, background: "#FAF7FE" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#6B46B8" }} />
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: "#241C33" }}>{item.food_name}</p>
                    {item.needs_review ? (
                      <p className="text-[10px] font-medium" style={{ color: "#8A5A06" }}>
                        Family dish · awaiting Prime Member&apos;s details{hint ? ` · ${hint}` : ""}
                      </p>
                    ) : hint ? (
                      <p className="text-[10px]" style={{ color: "#6A6180" }}>{hint}</p>
                    ) : null}
                  </div>
                </div>
                {mine ? (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-xs flex-shrink-0 ml-3"
                    style={{ background: "#FEF2F2", color: "#DC2626" }}
                    aria-label={`Remove ${item.food_name}`}
                  >
                    ✕
                  </button>
                ) : (
                  <span className="text-[10px] flex-shrink-0 ml-3" style={{ color: "#A79BC0" }}>
                    {memberNames[item.user_id] ?? ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add dish panel */}
      {adding && (
        <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid #E7DCF7", background: "#FAF7FE" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setNewCategory(null);
              if (!e.target.value.trim()) { setSuggestions([]); setSearched(""); }
            }}
            onKeyDown={e => { if (e.key === "Enter" && addCount) addChosen(); if (e.key === "Escape") cancelAdd(); }}
            placeholder="Search, or type a new dish name"
            aria-label="Dish name"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ border: "1.5px solid #6B46B8", background: "#FAF7FE", color: "#241C33", outline: "none" }}
          />

          {/* Browse by filters — tick as many as you like */}
          {!typed && (
            <div className="space-y-2">
              <FoodFilterBar value={filter} onChange={setFilter} idPrefix={`plan-${slotKey}`} slot={slotKey} />
              <div className="rounded-xl overflow-y-auto" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2", maxHeight: 300 }}>
                {browse.length === 0
                  ? <p className="text-xs text-center py-3" style={{ color: "#6A6180" }}>No dishes match these filters</p>
                  : browse.map(dishRow)}
              </div>
            </div>
          )}

          {/* Search results — also tickable */}
          {typed && suggestions.length > 0 && (
            <div className="rounded-xl overflow-y-auto" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2", maxHeight: 300 }}>
              {suggestions.map(dishRow)}
            </div>
          )}

          {/* What's ticked so far (tap to untick) */}
          {chosen.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Ticked dishes">
              {chosen.map(c => (
                <button key={c.id} type="button" onClick={() => toggleChosen(c)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "#E7DCF7", color: "#4B2D7A", border: "1px solid #CBB4EE" }}
                  aria-label={`Untick ${c.name}`}>
                  {c.name} ✕
                </button>
              ))}
            </div>
          )}

          {/* New dish → what kind is it? */}
          {isNewDish && kutumbhId && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "#625A75" }}>
                New dish — what kind is <b>{typed}</b>?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DISH_TYPES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setNewCategory(c.key)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium"
                    style={newCategory === c.key
                      ? { background: "#241238", color: "#fff" }
                      : { background: "#FAF7FE", color: "#625A75", border: "1px solid #E0D4F2" }}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "#8A5A06" }}>
                Saved as a Family Dish. The Prime Member will add its exact nutrition, ingredients and preparation.
              </p>
            </div>
          )}

          <button
            onClick={addChosen}
            disabled={saving || !addCount}
            className="w-full py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "#241238" }}
          >
            {saving ? "Adding…"
              : addCount ? `Add ${addCount} dish${addCount > 1 ? "es" : ""} to menu ✓`
              : isNewDish && kutumbhId ? "Pick what kind of dish it is"
              : "Tick the dishes to add"}
          </button>
        </div>
      )}
    </div>
  );
}
