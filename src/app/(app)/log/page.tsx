"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageNav from "@/components/PageNav";
import { SLOTS, isSlot, slotLabel, defaultPoolName, type Slot } from "@/lib/meal-slots";
import { DISH_TYPES, dishTypeOf, type DishType } from "@/lib/food-taxonomy";
import FoodFilterBar, { applyFoodFilter, sortForSlot, useMyFoodFilter, DietMark } from "@/components/FoodFilterBar";
import { todayLocal, longDateLocal } from "@/lib/dates";

// ── Types ─────────────────────────────────────────────────────────
type FoodItem = {
  id: string; name: string; name_ta: string | null; category: string;
  cuisine?: string | null; diet?: string | null; meal_hint?: string[] | null;
  calories: number | null; protein_g: number | null;
  serving_unit: string; serving_weight_g: number;
  ingredients: string | null; preparation: string | null;
  needs_review?: boolean | null;
};
type PoolRow = { key: string; food: FoodItem; plannerId: string };
type MealLog = {
  id: string; food_name: string; meal_slot: string;
  quantity_g: number; quantity_unit: string | null;
  calories: number | null; protein_g: number | null;
  nutrition_estimated: boolean | null;
};

// ── Constants ─────────────────────────────────────────────────────

const UNIT_LABEL: Record<string, string> = {
  piece: "pcs", cup: "cup", bowl: "bowl", serving: "serving",
  glass: "glass", tbsp: "tbsp", tsp: "tsp", plate: "plate", katori: "katori", g: "g",
};

const FOOD_COLS =
  "id,name,name_ta,category,cuisine,diet,meal_hint,calories,protein_g,serving_unit,serving_weight_g,ingredients,preparation,needs_review";

function stepFor(unit: string) { return unit === "g" ? 25 : unit === "tbsp" ? 1 : 0.5; }
function defaultQty(unit: string) { return unit === "g" ? 100 : 1; }
function quickPicks(unit: string) { return unit === "g" ? [50, 100, 150, 200] : [0.5, 1, 1.5, 2]; }
function fmtQty(q: number) { return q === 0.5 ? "½" : q === 1.5 ? "1½" : String(q); }

function toGrams(qty: number, food: FoodItem) {
  return food.serving_unit === "g" ? qty : Math.round(qty * (food.serving_weight_g || 100));
}

// Real values when the dish has them; otherwise its category's average
// per serving, flagged as an estimate until the Prime Member completes it.
function nutrition(food: FoodItem, qty: number) {
  if (food.calories != null) {
    const g = toGrams(qty, food);
    return {
      kcal: Math.round((food.calories * g) / 100),
      protein: food.protein_g != null ? Math.round((food.protein_g * g) / 100 * 10) / 10 : null,
      estimated: false,
    };
  }
  const d = dishTypeOf(food.category);
  const servings = food.serving_unit === "g" ? qty / d.servingG : qty;
  return { kcal: Math.round(servings * d.kcalPerServing), protein: null, estimated: true };
}

// Editing a logged portion scales its kcal/protein in proportion. A unit
// change can't be converted without the dish data, so nutrition is left as is.
function rescaleNutrition(
  log: Pick<MealLog, "quantity_g" | "quantity_unit" | "calories" | "protein_g"> | undefined,
  newQty: number, newUnit: string,
) {
  if (!log || !log.quantity_g || (log.quantity_unit ?? "serving") !== newUnit) return {};
  const f = newQty / log.quantity_g;
  return {
    calories:  log.calories  != null ? Math.round(log.calories * f) : null,
    protein_g: log.protein_g != null ? Math.round(log.protein_g * f * 10) / 10 : null,
  };
}

function perServingText(food: FoodItem) {
  const unit = food.serving_unit === "g" ? "100 g" : (UNIT_LABEL[food.serving_unit] ?? food.serving_unit);
  const n = nutrition(food, food.serving_unit === "g" ? 100 : 1);
  return n.estimated ? `~${n.kcal} kcal / ${unit} est.` : `${n.kcal} kcal / ${unit}`;
}

// ── Main component ────────────────────────────────────────────────
export default function LogPage() {
  const supabase     = createClient();
  const searchParams = useSearchParams();
  const today        = todayLocal();

  const [userId, setUserId]         = useState<string | null>(null);
  const [kutumbhId, setKutumbhId]   = useState<string | null>(null);
  const [logs, setLogs]             = useState<MealLog[]>([]);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);

  // Family pool for the open slot
  const [poolRows, setPoolRows]       = useState<PoolRow[]>([]);
  const [poolName, setPoolName]       = useState("");
  const [plannerNames, setPlannerNames] = useState<Record<string, string>>({});

  // Search
  const [query, setQuery]         = useState("");
  const [filter, setFilter]       = useMyFoodFilter();
  const [results, setResults]     = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Selection — everything ticked, with its own quantity
  const [picked, setPicked] = useState<Record<string, FoodItem>>({});
  const [qtys, setQtys]     = useState<Record<string, number>>({});

  const [saving, setSaving]         = useState(false);
  const [addingDish, setAddingDish] = useState(false);
  const [dishPicker, setDishPicker] = useState(false);

  // Inline edit for logged items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editQty, setEditQty]     = useState("1");
  const [editUnit, setEditUnit]   = useState("serving");

  // Photo capture + AI identification (outside food)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiChecked, setAiChecked]         = useState<Set<string>>(new Set());
  const [aiEdits, setAiEdits]             = useState<Record<string, string>>({});
  const [aiQtys, setAiQtys]               = useState<Record<string, number>>({});
  const [aiUnits, setAiUnits]             = useState<Record<string, string>>({});
  const [aiCals, setAiCals]               = useState<Record<string, string>>({});
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [collapsedSlots, setCollapsedSlots] = useState<Set<Slot>>(new Set());
  function toggleSlotCollapse(slot: Slot) {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }

  // ── Photo / AI ────────────────────────────────────────────────
  async function analyzePhoto(file: File) {
    setAnalyzing(true);
    setAiSuggestions(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type || "image/jpeg" }),
      });
      if (res.ok) {
        const { items } = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const edits: Record<string, string> = {};
          const qs:    Record<string, number> = {};
          const units: Record<string, string> = {};
          const cals:  Record<string, string> = {};
          const names: string[] = items.map((it: unknown) => {
            if (typeof it === "string") {
              edits[it] = it; qs[it] = 1; units[it] = "serving"; cals[it] = "";
              return it;
            }
            const obj = it as { name?: unknown; quantity?: unknown; unit?: unknown; calories?: unknown };
            const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "Unknown food";
            edits[name] = name;
            qs[name]    = typeof obj.quantity === "number" ? obj.quantity : 1;
            units[name] = typeof obj.unit     === "string" ? obj.unit     : "serving";
            cals[name]  = typeof obj.calories === "number" ? String(Math.round(obj.calories)) : "";
            return name;
          });
          setAiSuggestions(names);
          setAiChecked(new Set(names));
          setAiEdits(edits); setAiQtys(qs); setAiUnits(units); setAiCals(cals);
        }
      }
    } catch {
      // silent — user can still search or add manually
    } finally {
      setAnalyzing(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    analyzePhoto(file);
  }

  function clearPhoto() {
    setPhotoPreview(null);
    setAiSuggestions(null);
    setAiChecked(new Set());
    setAiEdits({}); setAiQtys({}); setAiUnits({}); setAiCals({});
    setAnalyzing(false);
    if (cameraRef.current)  cameraRef.current.value  = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function saveAiItems() {
    if (!aiChecked.size || !userId || !activeSlot) return;
    setSaving(true);
    const rows = Array.from(aiChecked).map(name => {
      const calStr   = aiCals[name];
      const calories = calStr && calStr.trim() !== "" ? parseFloat(calStr) : null;
      return {
        user_id:       userId,
        food_name:     (aiEdits[name] ?? name).trim() || name,
        meal_slot:     activeSlot,
        quantity_g:    aiQtys[name] ?? 1,
        quantity_unit: aiUnits[name] ?? "serving",
        calories:      calories != null && !isNaN(calories) ? Math.round(calories) : null,
        nutrition_estimated: calories != null && !isNaN(calories),
        logged_date:   today,
      };
    });
    const { error } = await supabase.from("meal_logs").insert(rows);
    setSaving(false);
    if (error) { alert(`Couldn't save your log: ${error.message}`); return; }
    closePanel();
    loadLogs();
  }

  // ── Data ──────────────────────────────────────────────────────
  // RLS lets members read each other's logs (for the Kutumbh tab), so this
  // must filter to the current user or family entries appear as your own.
  const loadLogs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("meal_logs")
      .select("id,food_name,meal_slot,quantity_g,quantity_unit,calories,protein_g,nutrition_estimated")
      .eq("user_id", userId)
      .eq("logged_date", today)
      .order("logged_at", { ascending: true });
    if (data) setLogs(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, userId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function loadPool(slot: Slot, kid: string | null) {
    setPoolRows([]);
    setPoolName(defaultPoolName(slot));
    if (!kid) return;

    const [{ data: plans }, { data: pool }] = await Promise.all([
      supabase
        .from("meal_plans")
        .select(`id, user_id, food_name, food_item_id, food_items(${FOOD_COLS})`)
        .eq("kutumbh_id", kid)
        .eq("meal_slot", slot)
        .eq("planned_date", today)
        .order("created_at", { ascending: true }),
      supabase
        .from("meal_pools")
        .select("name")
        .eq("kutumbh_id", kid)
        .eq("meal_slot", slot)
        .eq("planned_date", today)
        .maybeSingle(),
    ]);

    if (pool?.name) setPoolName(pool.name);

    // One row per dish; planned items without a catalogue link get a
    // synthetic key and are logged by name only.
    const seen = new Set<string>();
    const rows: PoolRow[] = [];
    for (const p of plans ?? []) {
      const fi = (Array.isArray(p.food_items) ? p.food_items[0] : p.food_items) as FoodItem | null;
      const key = p.food_item_id ?? `pool-${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key,
        plannerId: p.user_id,
        food: fi ?? {
          id: key, name: p.food_name, name_ta: null, category: "other",
          calories: null, protein_g: null, serving_unit: "serving", serving_weight_g: 100,
          ingredients: null, preparation: null, needs_review: false,
        },
      });
    }
    setPoolRows(rows);

    const ids = [...new Set(rows.map(r => r.plannerId))];
    if (ids.length) {
      const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const names: Record<string, string> = {};
      for (const pp of people ?? []) names[pp.id] = pp.full_name?.split(" ")[0] ?? "Family";
      setPlannerNames(names);
    }
  }

  // Resolve membership first, then honour a Dashboard ?slot= link, so the
  // family pool is available on the very first open.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: mem } = await supabase
        .from("kutumbh_members")
        .select("kutumbh_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const kid = mem?.kutumbh_id ?? null;
      setKutumbhId(kid);

      const slot = searchParams.get("slot");
      if (isSlot(slot)) openSlot(slot, kid);
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Search / browse the catalogue (+ this family's dishes, via RLS)
  useEffect(() => {
    if (!activeSlot) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const searchingByName = query.trim().length >= 2;
      let q = supabase.from("food_items").select(FOOD_COLS).order("name").limit(searchingByName ? 40 : 80);
      if (searchingByName) q = q.ilike("name", `%${query.trim()}%`);
      q = applyFoodFilter(q, filter, searchingByName);
      const { data } = await q;
      setResults(sortForSlot((data ?? []) as FoodItem[], activeSlot));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter, activeSlot]);

  // ── Selection ─────────────────────────────────────────────────
  function toggle(key: string, food: FoodItem) {
    if (picked[key]) {
      setPicked(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setPicked(prev => ({ ...prev, [key]: food }));
      setQtys(prev => ({ ...prev, [key]: prev[key] ?? defaultQty(food.serving_unit) }));
    }
  }

  function setQty(key: string, qty: number) {
    setQtys(prev => ({ ...prev, [key]: qty }));
  }

  function adjustQty(key: string, dir: 1 | -1) {
    const food = picked[key];
    if (!food) return;
    const s = stepFor(food.serving_unit);
    setQtys(prev => ({
      ...prev,
      [key]: Math.max(s, Math.round(((prev[key] ?? defaultQty(food.serving_unit)) + dir * s) * 10) / 10),
    }));
  }

  // Unknown dish → a Family Dish awaiting the Prime Member's details. Its
  // category sets the natural unit and the estimate used until then.
  async function addFamilyDish(category: DishType) {
    const name = query.trim();
    if (!name || !kutumbhId || !userId) return;
    setAddingDish(true);
    const { data: existing } = await supabase
      .from("food_items").select(FOOD_COLS)
      .eq("kutumbh_id", kutumbhId).ilike("name", name).limit(1).maybeSingle();
    let dish = existing as FoodItem | null;
    if (!dish) {
      const d = dishTypeOf(category);
      const { data, error } = await supabase
        .from("food_items")
        .insert({
          name, kutumbh_id: kutumbhId, created_by: userId, needs_review: true,
          category, serving_unit: d.unit, serving_weight_g: d.servingG, is_south_indian: true,
          cuisine: filter.cuisine === "indian" || filter.cuisine === "all" ? null : filter.cuisine,
        })
        .select(FOOD_COLS)
        .single();
      if (error) { setAddingDish(false); alert(`Couldn't add the dish: ${error.message}`); return; }
      dish = data as FoodItem;
    }
    setAddingDish(false);
    setDishPicker(false);
    setResults(prev => [dish!, ...prev.filter(r => r.id !== dish!.id)]);
    if (!picked[dish.id]) toggle(dish.id, dish);
  }

  // ── Panel open/close ──────────────────────────────────────────
  function openSlot(slot: Slot, kid: string | null = kutumbhId) {
    setActiveSlot(slot);
    setQuery(""); setFilter(f => ({ ...f, type: "" })); setDishPicker(false);
    setPicked({}); setQtys({});
    clearPhoto();
    loadPool(slot, kid);
  }

  function closePanel() {
    setActiveSlot(null);
    setPicked({}); setQtys({});
  }

  // ── Save ──────────────────────────────────────────────────────
  async function saveItems() {
    const keys = Object.keys(picked);
    if (!keys.length || !activeSlot || !userId) return;
    setSaving(true);
    const rows = keys.map(key => {
      const food = picked[key];
      const qty  = qtys[key] ?? defaultQty(food.serving_unit);
      const n    = nutrition(food, qty);
      return {
        // Synthetic "pool-…" keys aren't real food_items ids; sending one
        // fails the foreign key and rejects the whole batch.
        user_id:       userId,
        food_item_id:  key.startsWith("pool-") ? null : food.id,
        food_name:     food.name,
        meal_slot:     activeSlot,
        quantity_g:    qty,
        quantity_unit: food.serving_unit,
        calories:      n.kcal,
        protein_g:     n.protein,
        nutrition_estimated: n.estimated,
        logged_date:   today,
      };
    });
    const { error } = await supabase.from("meal_logs").insert(rows);
    setSaving(false);
    if (error) { alert(`Couldn't save your log: ${error.message}`); return; }
    closePanel();
    loadLogs();
  }

  async function deleteLog(id: string) {
    const { error } = await supabase.from("meal_logs").delete().eq("id", id);
    if (error) { alert(`Couldn't delete: ${error.message}`); return; }
    loadLogs();
  }

  function startEdit(log: MealLog) {
    setEditingId(log.id);
    setEditName(log.food_name);
    setEditQty(String(log.quantity_g));
    setEditUnit(log.quantity_unit ?? "serving");
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const newQty = parseFloat(editQty) || 1;
    const { error } = await supabase.from("meal_logs")
      .update({
        food_name:     editName.trim(),
        quantity_g:    newQty,
        quantity_unit: editUnit,
        ...rescaleNutrition(logs.find(l => l.id === editingId), newQty, editUnit),
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) { alert(`Save failed: ${error.message}`); return; }
    setEditingId(null);
    loadLogs();
  }

  // ── Derived ───────────────────────────────────────────────────
  const totalCal = logs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const logsFor  = (slot: Slot) => logs.filter(l => l.meal_slot === slot);

  const pickedKeys  = Object.keys(picked);
  const pickedCount = pickedKeys.length;
  const pickedNutri = pickedKeys.map(key => nutrition(picked[key], qtys[key] ?? defaultQty(picked[key].serving_unit)));
  const pickedCal   = pickedNutri.reduce((s, n) => s + n.kcal, 0);
  const pickedEst   = pickedNutri.some(n => n.estimated);
  const typed       = query.trim();
  const exactMatch  = results.some(r => r.name.toLowerCase() === typed.toLowerCase());

  const poolKeys    = new Set(poolRows.map(r => r.key));
  const resultKeys  = new Set(results.map(r => r.id));
  // Ticked items no longer visible (e.g. the search changed) stay reachable here
  const offscreen   = pickedKeys.filter(k => !poolKeys.has(k) && !resultKeys.has(k));
  const planners    = [...new Set(poolRows.map(r => plannerNames[r.plannerId]).filter(Boolean))];

  // ── A selectable food row with inline quantity when ticked ─────
  function foodRow(rowKey: string, food: FoodItem) {
    const isOn = !!picked[rowKey];
    const qty  = qtys[rowKey] ?? defaultQty(food.serving_unit);
    const n    = nutrition(food, qty);
    const unitLabel = UNIT_LABEL[food.serving_unit] ?? food.serving_unit;
    return (
      <div key={rowKey} className="rounded-xl overflow-hidden"
        style={{ background: isOn ? "#EAF2E8" : "#fff", border: `1.5px solid ${isOn ? "#4A7C44" : "#E2E1D8"}` }}>
        <button onClick={() => toggle(rowKey, food)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
          <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
            style={{ background: isOn ? "#4A7C44" : "#fff", border: `2px solid ${isOn ? "#4A7C44" : "#C8C5BA"}` }}>
            {isOn && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span className="text-lg shrink-0" aria-hidden>{dishTypeOf(food.category).icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: "#1C201C" }}>
              <DietMark diet={food.diet} /><span className="truncate">{food.name}</span>
            </p>
            <p className="text-xs truncate" style={{ color: food.needs_review ? "#A5661A" : "#8A9085" }}>
              {food.needs_review ? `Family dish · ${perServingText(food)}` : perServingText(food)}
            </p>
          </div>
        </button>

        {isOn && (
          <div className="px-3 pb-3 space-y-2">
            {(food.ingredients || food.preparation) && (
              <div className="rounded-lg px-2.5 py-1.5 space-y-0.5" style={{ background: "#F6F5EE" }}>
                {food.ingredients && (
                  <p className="text-xs leading-snug" style={{ color: "#5A6055" }}>
                    <span className="font-semibold" style={{ color: "#8A9085" }}>Ingredients: </span>{food.ingredients}
                  </p>
                )}
                {food.preparation && (
                  <p className="text-xs leading-snug" style={{ color: "#5A6055" }}>
                    <span className="font-semibold" style={{ color: "#8A9085" }}>Prep: </span>{food.preparation}
                  </p>
                )}
              </div>
            )}
            {/* Quick portions */}
            <div className="flex gap-1.5">
              {quickPicks(food.serving_unit).map(q => (
                <button key={q} onClick={() => setQty(rowKey, q)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                  style={qty === q
                    ? { background: "#1C2B1C", color: "#fff" }
                    : { background: "#fff", color: "#2E5C28", border: "1px solid #C5DFC2" }}>
                  {fmtQty(q)}{food.serving_unit === "g" ? " g" : ""}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => adjustQty(rowKey, -1)} aria-label="Less"
                className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                style={{ background: "#fff", color: "#2E5C28", border: "1px solid #C5DFC2" }}>−</button>
              <p className="text-sm font-semibold min-w-[4.5rem] text-center" style={{ color: "#1C201C" }}>
                {fmtQty(qty)} {unitLabel}
              </p>
              <button onClick={() => adjustQty(rowKey, 1)} aria-label="More"
                className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                style={{ background: "#fff", color: "#2E5C28", border: "1px solid #C5DFC2" }}>+</button>
              <p className="ml-auto text-xs font-semibold text-right" style={{ color: n.estimated ? "#A5661A" : "#4A7C44" }}>
                {n.estimated ? `~${n.kcal} kcal est.` : `${n.kcal} kcal`}
                {n.protein != null && <span className="block font-normal" style={{ color: "#8A9085" }}>{n.protein} g protein</span>}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>

      {/* Header */}
      <header style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}>
        <div className="px-5 py-4">
          <PageNav />
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            {longDateLocal()}
          </p>
          <h1 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Log Food</h1>
          {totalCal > 0 && (
            <p className="text-sm mt-0.5" style={{ color: "#8FBF88" }}>{totalCal} kcal logged today</p>
          )}
        </div>
      </header>

      {/* Slot cards */}
      <main className="flex-1 px-4 py-5 space-y-3">
        {SLOTS.map(({ key, label, icon, time }) => {
          const slotLogs    = logsFor(key);
          const slotCal     = slotLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
          const isCollapsed = collapsedSlots.has(key);
          return (
            <div key={key} className="rounded-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid #E2E1D8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#EAF2E8" }}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1C201C" }}>{label}</p>
                    <p className="text-xs" style={{ color: slotLogs.length > 0 ? "#4A7C44" : "#8A9085" }}>
                      {slotLogs.length > 0
                        ? `${slotLogs.length} item${slotLogs.length > 1 ? "s" : ""}${slotCal > 0 ? ` · ${slotCal} kcal` : ""}`
                        : time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {slotLogs.length > 0 && (
                    <button
                      onClick={() => toggleSlotCollapse(key)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-semibold"
                      style={{ background: isCollapsed ? "#EAF2E8" : "#1C2B1C", color: isCollapsed ? "#4A7C44" : "#fff" }}
                      aria-label={isCollapsed ? "Expand" : "Collapse"}
                    >
                      {isCollapsed ? "+" : "−"}
                    </button>
                  )}
                  <button onClick={() => openSlot(key)} aria-label={`Log ${label}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: "#EAF2E8", color: "#4A7C44" }}>✎</button>
                </div>
              </div>
              {slotLogs.length > 0 && !isCollapsed && (
                <div style={{ borderTop: "1px solid #F0EFE8" }}>
                  {slotLogs.map(log => (
                    <div key={log.id} style={{ borderBottom: "1px solid #F6F5EE" }}>
                      {editingId === log.id ? (
                        <div className="px-4 py-3 space-y-2">
                          <input
                            type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                            className="w-full rounded-xl px-3 py-2 text-sm"
                            style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditQty(q => String(Math.max(0.5, parseFloat(q) - 0.5)))}
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                              style={{ background: "#EAF2E8", color: "#1C2B1C" }}>−</button>
                            <input
                              type="number" min="0.5" step="0.5" value={editQty}
                              onChange={e => setEditQty(e.target.value)}
                              className="w-16 text-center rounded-lg px-2 py-1.5 text-sm font-semibold"
                              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                            <button onClick={() => setEditQty(q => String(parseFloat(q) + 0.5))}
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                              style={{ background: "#EAF2E8", color: "#1C2B1C" }}>+</button>
                            <select value={editUnit} onChange={e => setEditUnit(e.target.value)}
                              className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}>
                              <option value="serving">serving</option>
                              <option value="piece">piece(s)</option>
                              <option value="bowl">bowl</option>
                              <option value="cup">cup</option>
                              <option value="glass">glass</option>
                              <option value="tbsp">tbsp</option>
                              <option value="g">grams</option>
                            </select>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveEdit} disabled={saving || !editName.trim()}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                              style={{ background: "#1C2B1C" }}>
                              {saving ? "Saving…" : "Save ✓"}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: "#F0EFE8", color: "#5A6055" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: "#1C201C" }}>{log.food_name}</p>
                            <p className="text-xs" style={{ color: "#8A9085" }}>
                              {log.quantity_g} {log.quantity_unit ?? "serving"}
                              {log.calories  != null ? (log.nutrition_estimated ? ` · ~${log.calories} kcal est.` : ` · ${log.calories} kcal`) : ""}
                              {log.protein_g != null ? ` · ${log.protein_g}g protein` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            <button onClick={() => startEdit(log)} aria-label="Edit"
                              className="w-7 h-7 flex items-center justify-center rounded-lg"
                              style={{ background: "#EAF2E8" }}>
                              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                                <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#4A7C44" strokeWidth="1.5" strokeLinejoin="round"/>
                                <path d="M7.5 3L10 5.5" stroke="#4A7C44" strokeWidth="1.5"/>
                              </svg>
                            </button>
                            <button onClick={() => deleteLog(log.id)} aria-label="Delete"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold"
                              style={{ color: "#C05050", background: "#FEF2F2" }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* ══ Slide-up panel: one screen — pick, set qty, log ══ */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.4)" }}>
          <button className="flex-1 min-h-[6vh]" onClick={closePanel} aria-label="Close" />
          <div className="rounded-t-3xl flex flex-col overflow-hidden" style={{ background: "#F6F5EE", maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0"
              style={{ borderBottom: "1px solid #E2E1D8" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A9085" }}>
                  What did you eat?
                </p>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#1C201C" }}>
                  {slotLabel(activeSlot)}
                </h2>
              </div>
              <button onClick={closePanel} aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: "#E2E1D8", color: "#5A6055" }}>✕</button>
            </div>

            {/* Single scroll area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">

              {/* Family pool */}
              {poolRows.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#4A7C44" }}>
                    {poolName}
                  </p>
                  <p className="text-xs mb-2" style={{ color: "#8A9085" }}>
                    {planners.length ? `Planned by ${planners.join(", ")} · ` : ""}tap what you ate and set your portion
                  </p>
                  <div className="space-y-1.5">
                    {poolRows.map(r => foodRow(r.key, r.food))}
                  </div>
                </section>
              )}

              {/* Ticked items that scrolled out of view */}
              {offscreen.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8A9085" }}>
                    Also on your plate
                  </p>
                  <div className="space-y-1.5">
                    {offscreen.map(k => foodRow(k, picked[k]))}
                  </div>
                </section>
              )}

              {/* Search */}
              <section>
                {poolRows.length > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                    <span className="text-xs" style={{ color: "#8A9085" }}>add something else</span>
                    <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                  </div>
                )}
                <input type="search" value={query} onChange={e => { setQuery(e.target.value); setDishPicker(false); }}
                  aria-label="Search food"
                  placeholder="Search food…"
                  className="w-full rounded-xl px-4 py-2.5 text-sm mb-2"
                  style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                {query.trim().length < 2 && (
                  <div className="mb-2"><FoodFilterBar value={filter} onChange={setFilter} idPrefix="log" /></div>
                )}

                <div className="space-y-1.5">
                  {searching && <p className="text-xs text-center py-3" style={{ color: "#8A9085" }}>Loading…</p>}
                  {!searching && results
                    .filter(f => !poolKeys.has(f.id))
                    .map(f => foodRow(f.id, f))}
                  {!searching && typed.length >= 2 && !exactMatch && (
                    kutumbhId ? (
                      <div className="rounded-xl px-3 py-2.5"
                        style={{ background: "#FBEFD9", border: "1.5px dashed #E4B774", color: "#7A4C12" }}>
                        {!dishPicker ? (
                          <button onClick={() => setDishPicker(true)} className="w-full text-left text-sm">
                            ＋ Add <b>“{typed}”</b> as a Family Dish
                            <span className="block text-xs mt-0.5" style={{ color: "#A5661A" }}>
                              The Prime Member will add its exact nutrition, ingredients and preparation
                            </span>
                          </button>
                        ) : (
                          <>
                            <p className="text-xs mb-1.5">What kind of dish is <b>{typed}</b>?</p>
                            <div className="flex flex-wrap gap-1.5">
                              {DISH_TYPES.map(c => (
                                <button key={c.key} onClick={() => addFamilyDish(c.key)} disabled={addingDish}
                                  className="px-2.5 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                                  style={{ background: "#fff", color: "#5A4012", border: "1px solid #E4B774" }}>
                                  {c.icon} {c.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : results.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: "#8A9085" }}>No items found</p>
                    ) : null
                  )}
                </div>
              </section>

              {/* Ate outside? — photo */}
              <section className="pb-2">
                <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                  onChange={handlePhotoChange} className="hidden" />
                <input ref={galleryRef} type="file" accept="image/*"
                  onChange={handlePhotoChange} className="hidden" />

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                  <span className="text-xs" style={{ color: "#8A9085" }}>ate outside?</span>
                  <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                </div>

                {photoPreview && (
                  <div className="mb-3">
                    <div className="relative rounded-2xl overflow-hidden"
                      style={{ background: "#1C201C", minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Food photo"
                        style={{ width: "100%", maxHeight: "220px", objectFit: "contain", display: "block" }} />
                      <button onClick={clearPhoto} aria-label="Remove photo"
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>✕</button>
                    </div>
                  </div>
                )}

                {!photoPreview && !analyzing && !aiSuggestions && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => cameraRef.current?.click()}
                      className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                      style={{ background: "#fff", border: "1.5px dashed #C5DFC2" }}>
                      <span className="text-2xl">📷</span>
                      <span className="text-xs font-medium" style={{ color: "#4A7C44" }}>Take Photo</span>
                    </button>
                    <button onClick={() => galleryRef.current?.click()}
                      className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                      style={{ background: "#fff", border: "1.5px dashed #C5DFC2" }}>
                      <span className="text-2xl">🖼️</span>
                      <span className="text-xs font-medium" style={{ color: "#4A7C44" }}>From Gallery</span>
                    </button>
                  </div>
                )}

                {analyzing && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                    style={{ background: "#EAF2E8", border: "1px solid #C5DFC2" }}>
                    <span className="text-base animate-spin" style={{ display: "inline-block" }}>🔄</span>
                    <span className="text-sm font-medium" style={{ color: "#4A7C44" }}>Identifying dishes…</span>
                  </div>
                )}

                {aiSuggestions && aiSuggestions.length > 0 && !analyzing && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #C5DFC2", background: "#F0F7EF" }}>
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#4A7C44" }}>
                        ✨ {aiSuggestions.length} item{aiSuggestions.length > 1 ? "s" : ""} identified
                      </p>
                      <p className="text-xs" style={{ color: "#8A9085" }}>uncheck to remove</p>
                    </div>
                    {aiSuggestions.map((item, i) => {
                      const isOn = aiChecked.has(item);
                      return (
                        <div key={item} style={{ borderTop: i > 0 ? "1px solid #D5EBD2" : undefined }}>
                          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: isOn ? "#EAF2E8" : "#fff" }}>
                            <button
                              onClick={() => { const n = new Set(aiChecked); if (isOn) n.delete(item); else n.add(item); setAiChecked(n); }}
                              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                              style={{ background: isOn ? "#4A7C44" : "#fff", border: `2px solid ${isOn ? "#4A7C44" : "#B0C4AE"}` }}>
                              {isOn && <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </button>
                            <input id={`ai-${i}`} type="text" value={aiEdits[item] ?? item}
                              onChange={e => setAiEdits(p => ({ ...p, [item]: e.target.value }))}
                              className="flex-1 text-sm font-medium bg-transparent rounded-lg px-2 py-1"
                              style={{ color: isOn ? "#1C2B1C" : "#8A9085", border: "1.5px solid #D5EBD2", outline: "none", minWidth: 0 }} />
                          </div>
                          <div className="flex items-center gap-2 px-4 pb-3" style={{ background: isOn ? "#EAF2E8" : "#fff" }}>
                            <button onClick={() => setAiQtys(p => ({ ...p, [item]: Math.max(0.5, (p[item] ?? 1) - 0.5) }))}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold"
                              style={{ background: "#D5EBD2", color: "#1C2B1C" }}>−</button>
                            <span className="text-sm font-semibold w-8 text-center" style={{ color: "#1C2B1C" }}>
                              {aiQtys[item] ?? 1}
                            </span>
                            <button onClick={() => setAiQtys(p => ({ ...p, [item]: (p[item] ?? 1) + 0.5 }))}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold"
                              style={{ background: "#D5EBD2", color: "#1C2B1C" }}>+</button>
                            <select value={aiUnits[item] ?? "serving"}
                              onChange={e => setAiUnits(p => ({ ...p, [item]: e.target.value }))}
                              className="rounded-lg px-2 py-1.5 text-xs"
                              style={{ border: "1.5px solid #C5DFC2", background: "#fff", color: "#1C2B1C", outline: "none", width: "5.5rem" }}>
                              {["serving", "piece", "bowl", "cup", "glass", "tbsp", "g"].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <div className="flex items-center gap-1 ml-auto">
                              <input type="number" min="0" value={aiCals[item] ?? ""}
                                onChange={e => setAiCals(p => ({ ...p, [item]: e.target.value }))}
                                placeholder="kcal"
                                className="w-14 rounded-lg px-2 py-1.5 text-xs text-center"
                                style={{ border: "1.5px solid #C5DFC2", background: "#fff", color: "#1C2B1C", outline: "none" }} />
                              <span className="text-xs" style={{ color: "#8A9085" }}>kcal</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-4 py-3" style={{ borderTop: "1px solid #D5EBD2" }}>
                      <button onClick={saveAiItems} disabled={saving || aiChecked.size === 0}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                        style={{ background: "#1C2B1C" }}>
                        {saving ? "Saving…" : aiChecked.size === 0 ? "Select at least one item"
                          : `Log ${aiChecked.size} outside item${aiChecked.size > 1 ? "s" : ""} ✓`}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Always-visible action bar */}
            <div className="shrink-0 px-4 pt-3" style={{
              background: "#F6F5EE", borderTop: "1px solid #E2E1D8",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            }}>
              <button onClick={saveItems} disabled={saving || pickedCount === 0}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                style={{ background: "#1C2B1C" }}>
                {saving
                  ? "Saving…"
                  : pickedCount === 0
                    ? "Tick what you ate"
                    : `Log ${pickedCount} item${pickedCount > 1 ? "s" : ""} · ${pickedEst ? "~" : ""}${pickedCal} kcal ✓`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
