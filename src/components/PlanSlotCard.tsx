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
  const [selectedFood, setSelectedFood] = useState<FoodSuggestion | null>(null);
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
        .limit(8);
      setSuggestions((data ?? []) as FoodSuggestion[]);
      setSearched(q);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter.diet]);

  // Browse by Cuisine → Diet → Dish type while nothing is typed
  useEffect(() => {
    if (!adding || query.trim()) return;
    let cancelled = false;
    (async () => {
      const q = applyFoodFilter(
        supabase.from("food_items").select(SUGGEST_COLS).order("name").limit(60), filter, false);
      const { data } = await q;
      if (!cancelled) setBrowse(sortForSlot((data ?? []) as FoodSuggestion[], slotKey).slice(0, 30));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, query, filter]);

  function openAdd() {
    setAdding(true);
    setQuery(""); setSuggestions([]); setSearched("");
    setSelectedFood(null); setNewCategory(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function cancelAdd() {
    setAdding(false);
    setQuery(""); setSuggestions([]); setSearched("");
    setSelectedFood(null); setNewCategory(null);
  }

  const typed         = query.trim();
  const exactMatch    = suggestions.find(s => s.name.toLowerCase() === typed.toLowerCase()) ?? null;
  const isNewDish     = !!typed && !selectedFood && !exactMatch && searched === typed;
  const canAdd        = !!typed && (!!selectedFood || !!exactMatch || (isNewDish && (!kutumbhId || !!newCategory)));

  // New dish → a Family Dish (family-only), awaiting the Prime Member's details
  async function createFamilyDish(dishName: string, category: DishType) {
    const d = dishTypeOf(category);
    const { data, error } = await supabase
      .from("food_items")
      .insert({
        name: dishName, kutumbh_id: kutumbhId, created_by: userId, needs_review: true,
        category, serving_unit: d.unit, serving_weight_g: d.servingG, is_south_indian: true,
        cuisine: filter.cuisine === "indian" || filter.cuisine === "all" ? null : filter.cuisine,
      })
      .select(SUGGEST_COLS)
      .single();
    if (error) { alert(`Couldn't add the dish: ${error.message}`); return null; }
    return data as FoodSuggestion;
  }

  async function addItem() {
    if (!canAdd || saving) return;
    setSaving(true);

    let food = selectedFood ?? exactMatch;
    if (!food && kutumbhId && newCategory) {
      food = await createFamilyDish(typed, newCategory);
      if (!food) { setSaving(false); return; }
    }

    const { data, error } = await supabase
      .from("meal_plans")
      .insert({
        user_id:       userId,
        kutumbh_id:    kutumbhId ?? null,
        planned_date:  todayLocal(),
        meal_slot:     slotKey,
        food_name:     food?.name ?? typed,
        quantity_g:    1,
        quantity_unit: food?.serving_unit ?? "serving",
        food_item_id:  food?.id ?? null,
      })
      .select("id, user_id, food_name")
      .single();
    setSaving(false);
    if (error || !data) { alert(`Couldn't add to the menu: ${error?.message ?? "unknown error"}`); return; }

    setItems(prev => [...prev, {
      id: data.id, user_id: data.user_id, food_name: data.food_name,
      needs_review:     !!food?.needs_review,
      category:         food?.category ?? null,
      serving_unit:     food?.serving_unit ?? null,
      kcal_per_serving: food ? perServingKcal(food) : null,
    }]);
    // Stay open so the next dish can be added straight away
    setQuery(""); setSuggestions([]); setSearched("");
    setSelectedFood(null); setNewCategory(null);
    setTimeout(() => inputRef.current?.focus(), 60);
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
      style={{ background: "#fff", border: "1px solid #E2E1D8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Slot header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: hasItems ? "#EAF2E8" : "#F3F2EB" }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm" style={{ color: "#1C201C" }}>{name}</p>
            <p className="text-xs mt-0.5" style={{ color: hasItems ? "#4A7C44" : "#8A9085" }}>
              {hasItems ? `${items.length} dish${items.length > 1 ? "es" : ""} on the menu` : `${time} · Nothing planned`}
            </p>
          </div>
        </div>
        <button
          onClick={adding ? cancelAdd : openAdd}
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: adding ? "#1C2B1C" : "#EAF2E8", color: adding ? "#fff" : "#4A7C44" }}
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
                style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
              />
              <button onClick={savePoolName} className="text-xs font-semibold" style={{ color: "#4A7C44" }}>Save</button>
              <button onClick={() => setRenaming(false)} className="text-xs" style={{ color: "#8A9085" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setDraftName(poolName); setRenaming(true); }} className="text-left" aria-label="Rename this menu">
              <span className="text-xs font-semibold" style={{ color: "#1C2B1C" }}>{poolName}</span>
              <span className="text-xs" style={{ color: "#8A9085" }}> · planned by {planners.join(", ")} </span>
              <span className="text-xs" style={{ color: "#4A7C44" }}>✎</span>
            </button>
          )}
        </div>
      )}

      {/* Menu items */}
      {hasItems && (
        <div style={{ borderTop: "1px solid #EAF2E8" }}>
          {items.map((item, i) => {
            const mine = item.user_id === userId;
            const hint = servingHint(item);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid #F3F2EB" : undefined, background: "#FAFAF8" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4A7C44" }} />
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: "#1C201C" }}>{item.food_name}</p>
                    {item.needs_review ? (
                      <p className="text-[10px] font-medium" style={{ color: "#A5661A" }}>
                        Family dish · awaiting Prime Member&apos;s details{hint ? ` · ${hint}` : ""}
                      </p>
                    ) : hint ? (
                      <p className="text-[10px]" style={{ color: "#8A9085" }}>{hint}</p>
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
                  <span className="text-[10px] flex-shrink-0 ml-3" style={{ color: "#B5B0A8" }}>
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
        <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid #EAF2E8", background: "#FAFAF8" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedFood(null);
              setNewCategory(null);
              if (!e.target.value.trim()) { setSuggestions([]); setSearched(""); }
            }}
            onKeyDown={e => { if (e.key === "Enter" && canAdd) addItem(); if (e.key === "Escape") cancelAdd(); }}
            placeholder="Dish name, e.g. Sambar"
            aria-label="Dish name"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
          />

          {/* Browse by filters */}
          {!typed && (
            <div className="space-y-2">
              <FoodFilterBar value={filter} onChange={setFilter} idPrefix={`plan-${slotKey}`} />
              <div className="rounded-xl overflow-y-auto" style={{ background: "#fff", border: "1px solid #E2E1D8", maxHeight: 260 }}>
                {browse.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: "#8A9085" }}>No dishes match these filters</p>
                ) : browse.map((s, i) => {
                  const k = perServingKcal(s);
                  return (
                    <button key={s.id}
                      onClick={() => { setSelectedFood(s); setQuery(s.name); setSearched(s.name); }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2"
                      style={{ borderTop: i > 0 ? "1px solid #F3F2EB" : undefined, color: "#1C201C" }}>
                      <span className="truncate flex items-center gap-1.5">
                        <span aria-hidden>{dishTypeOf(s.category).icon}</span>
                        <DietMark diet={s.diet} />
                        <span className="truncate">{s.name}</span>
                      </span>
                      {k != null && (
                        <span className="text-xs flex-shrink-0" style={{ color: "#8A9085" }}>
                          {k} kcal / {s.serving_unit === "g" ? "100 g" : (s.serving_unit ?? "serving")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matches */}
          {suggestions.length > 0 && !selectedFood && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E2E1D8" }}>
              {suggestions.map((s, i) => {
                const k = perServingKcal(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedFood(s); setQuery(s.name); setSuggestions([]); }}
                    className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2"
                    style={{ borderTop: i > 0 ? "1px solid #F3F2EB" : undefined, color: "#1C201C" }}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <DietMark diet={s.diet} />
                      {s.name}
                      {s.kutumbh_id && (
                        <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#A5661A" }}>FAMILY DISH</span>
                      )}
                    </span>
                    {k != null && (
                      <span className="text-xs flex-shrink-0" style={{ color: "#8A9085" }}>
                        {k} kcal / {s.serving_unit === "g" ? "100 g" : (s.serving_unit ?? "serving")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* New dish → what kind is it? */}
          {isNewDish && kutumbhId && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "#5A6055" }}>
                New dish — what kind is <b>{typed}</b>?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DISH_TYPES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setNewCategory(c.key)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium"
                    style={newCategory === c.key
                      ? { background: "#1C2B1C", color: "#fff" }
                      : { background: "#fff", color: "#5A6055", border: "1px solid #E2E1D8" }}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "#A5661A" }}>
                Saved as a Family Dish. The Prime Member will add its exact nutrition, ingredients and preparation.
              </p>
            </div>
          )}

          <button
            onClick={addItem}
            disabled={saving || !canAdd}
            className="w-full py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "#1C2B1C" }}
          >
            {saving ? "Adding…" : isNewDish && kutumbhId && !newCategory ? "Pick what kind of dish it is" : "Add to menu ✓"}
          </button>
        </div>
      )}
    </div>
  );
}
