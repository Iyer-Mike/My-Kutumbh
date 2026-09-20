"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageNav from "@/components/PageNav";

// ── Types ─────────────────────────────────────────────────────────
type FoodItem = {
  id: string; name: string; name_ta: string | null; category: string;
  calories: number | null; protein_g: number | null;
  serving_unit: string; serving_weight_g: number;
  ingredients: string | null; preparation: string | null;
};
type PoolPlanItem = {
  planId: string;
  foodItemId: string | null;
  foodName: string;
  caloriesPerServing: number | null;
  servingWeightG: number;
  servingUnit: string;
  calsPer100g: number | null;
};
type MealLog = {
  id: string; food_name: string; meal_slot: string;
  quantity_g: number; quantity_unit: string | null;
  calories: number | null; protein_g: number | null;
};
type Slot = "breakfast" | "lunch" | "dinner" | "other";

// ── Constants ─────────────────────────────────────────────────────
const SLOTS: { key: Slot; label: string; icon: string; time: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "☀️",  time: "7 – 9 am"  },
  { key: "lunch",     label: "Lunch",     icon: "🌤️", time: "12 – 2 pm" },
  { key: "dinner",   label: "Dinner",    icon: "🌙",  time: "7 – 9 pm"  },
  { key: "other",    label: "Other",     icon: "＋",  time: "Any time"  },
];

const CAT_TABS = [
  { key: "",          label: "All"     },
  { key: "grain",     label: "Grains"  },
  { key: "legume",    label: "Dal"     },
  { key: "vegetable", label: "Veggies" },
  { key: "fruit",     label: "Fruits"  },
  { key: "dairy",     label: "Dairy"   },
  { key: "snack",     label: "Snacks"  },
  { key: "sweet",     label: "Sweets"  },
  { key: "beverage",  label: "Drinks"  },
];

const CAT_ICON: Record<string, string> = {
  grain: "🌾", legume: "🫘", vegetable: "🥦", fruit: "🍎",
  dairy: "🥛", snack: "🥨", sweet: "🍮", spice: "🌶️",
  beverage: "☕", other: "🍽️",
};

const UNIT_LABEL: Record<string, string> = {
  piece: "pcs", cup: "cup", bowl: "bowl",
  glass: "glass", tbsp: "tbsp", g: "g",
};

const STEP: Record<string, number> = {
  piece: 0.5, cup: 0.5, bowl: 0.5, glass: 0.5, tbsp: 1, g: 25,
};

const MIN_QTY: Record<string, number> = {
  piece: 0.5, cup: 0.5, bowl: 0.5, glass: 0.5, tbsp: 1, g: 25,
};

function toGrams(qty: number, food: FoodItem) {
  return food.serving_unit === "g" ? qty : Math.round(qty * food.serving_weight_g);
}

function calcCal(food: FoodItem, grams: number) {
  if (!food.calories) return null;
  return Math.round((food.calories * grams) / 100);
}

function qtyLabel(qty: number, unit: string) {
  if (unit === "piece") return qty === 0.5 ? "½ pc" : `${qty} pc${qty !== 1 ? "s" : ""}`;
  return `${qty} ${UNIT_LABEL[unit] ?? unit}`;
}

// ── Main component ────────────────────────────────────────────────
export default function LogPage() {
  const supabase     = createClient();
  const searchParams = useSearchParams();
  const today        = new Date().toISOString().split("T")[0];

  const [userId, setUserId]         = useState<string | null>(null);
  const [kutumbhId, setKutumbhId]   = useState<string | null>(null);
  const [logs, setLogs]             = useState<MealLog[]>([]);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [poolItems, setPoolItems]   = useState<PoolPlanItem[]>([]);

  // Step 1 — select
  const [query, setQuery]         = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [results, setResults]     = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [checked, setChecked]     = useState<Set<string>>(new Set());
  const [foodMap, setFoodMap]     = useState<Record<string, FoodItem>>({});

  // Step 2 — set quantities
  const [step, setStep]           = useState<"select" | "qty">("select");
  const [quantities, setQties]    = useState<Record<string, number>>({});

  const [saving, setSaving]       = useState(false);

  // Inline edit for logged items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editQty, setEditQty]     = useState("1");
  const [editUnit, setEditUnit]   = useState("serving");

  // Manual entry (Other slot)
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal]   = useState("");
  const [manualQty, setManualQty]   = useState("1");
  const [manualUnit, setManualUnit] = useState("serving");
  const [manualNote, setManualNote] = useState("");
  const [manualSlot, setManualSlot] = useState<Slot>("other");

  // Photo capture + AI identification (outside food)
  const [photoFile, setPhotoFile]         = useState<File | null>(null);
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiChecked, setAiChecked]         = useState<Set<string>>(new Set());
  const [aiEdits, setAiEdits]             = useState<Record<string, string>>({});
  const [aiQtys, setAiQtys]              = useState<Record<string, number>>({});
  const [aiUnits, setAiUnits]            = useState<Record<string, string>>({});
  const [aiCals, setAiCals]              = useState<Record<string, string>>({});
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Collapsed state for slot item lists
  const [collapsedSlots, setCollapsedSlots] = useState<Set<Slot>>(new Set());
  function toggleSlotCollapse(slot: Slot) {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }

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
          const qtys:  Record<string, number> = {};
          const units: Record<string, string> = {};
          const cals:  Record<string, string> = {};
          const names: string[] = items.map((it: unknown) => {
            if (typeof it === "string") {
              edits[it] = it; qtys[it] = 1; units[it] = "serving"; cals[it] = "";
              return it;
            }
            const obj = it as { name?: unknown; quantity?: unknown; unit?: unknown; calories?: unknown };
            const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "Unknown food";
            edits[name] = name;
            qtys[name]  = typeof obj.quantity === "number" ? obj.quantity : 1;
            units[name] = typeof obj.unit     === "string" ? obj.unit     : "serving";
            cals[name]  = typeof obj.calories === "number" ? String(Math.round(obj.calories)) : "";
            return name;
          });
          setAiSuggestions(names);
          setAiChecked(new Set(names));
          setAiEdits(edits);
          setAiQtys(qtys);
          setAiUnits(units);
          setAiCals(cals);
        }
      }
    } catch {
      // silent — user can still enter manually
    } finally {
      setAnalyzing(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    analyzePhoto(file);
  }

  function clearPhoto() {
    setPhotoFile(null);
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
        logged_date:   today,
      };
    });
    await supabase.from("meal_logs").insert(rows);
    setSaving(false);
    closePanel();
    loadLogs();
  }

  // ── Data ──────────────────────────────────────────────────────
  // Fetch user id + kutumbh membership once on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: mem } = await supabase
        .from("kutumbh_members")
        .select("kutumbh_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setKutumbhId(mem?.kutumbh_id ?? null);
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("meal_logs")
      .select("id,food_name,meal_slot,quantity_g,quantity_unit,calories,protein_g")
      .eq("logged_date", today)
      .order("logged_at", { ascending: true });
    if (data) setLogs(data);
  }, [today]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function loadPoolForSlot(slot: Slot, kid: string | null) {
    if (!kid || slot === "other") { setPoolItems([]); return; }
    const { data } = await supabase
      .from("meal_plans")
      .select("id, food_name, food_item_id, calories, food_items(serving_weight_g, serving_unit, calories)")
      .eq("kutumbh_id", kid)
      .eq("meal_slot", slot)
      .eq("planned_date", today);

    const items: PoolPlanItem[] = (data ?? []).map(p => {
      const fi = Array.isArray(p.food_items) ? (p.food_items as Record<string,unknown>[])[0] : p.food_items as Record<string,unknown> | null;
      return {
        planId: p.id as string,
        foodItemId: p.food_item_id as string | null ?? null,
        foodName: p.food_name as string,
        caloriesPerServing: p.calories as number | null ?? null,
        servingWeightG: (fi?.serving_weight_g as number) ?? 100,
        servingUnit: (fi?.serving_unit as string) ?? "serving",
        calsPer100g: (fi?.calories as number) ?? null,
      };
    });

    setPoolItems(items);

    // Pre-check all pool items and seed foodMap with synthetic FoodItem entries
    const newFoodMap: Record<string, FoodItem> = {};
    const newIds = new Set<string>();
    items.forEach(item => {
      const id = item.foodItemId ?? `pool-${item.planId}`;
      newFoodMap[id] = {
        id,
        name: item.foodName,
        name_ta: null,
        category: "other",
        calories: item.calsPer100g,
        protein_g: null,
        serving_unit: item.servingUnit,
        serving_weight_g: item.servingWeightG,
        ingredients: null,
        preparation: null,
      };
      newIds.add(id);
    });
    setFoodMap(prev => ({ ...prev, ...newFoodMap }));
    setChecked(newIds);
  }

  // Auto-open a slot when arriving from the Dashboard ?slot= param
  useEffect(() => {
    const slot = searchParams.get("slot") as Slot | null;
    if (slot && ["breakfast", "lunch", "dinner", "other"].includes(slot)) {
      openSlot(slot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSlot || activeSlot === "other") return;
    const t = setTimeout(async () => {
      setSearching(true);
      let q = supabase
        .from("food_items")
        .select("id,name,name_ta,category,calories,protein_g,serving_unit,serving_weight_g,ingredients,preparation")
        .limit(40);
      if (query.trim().length >= 2) {
        q = q.ilike("name", `%${query.trim()}%`);
      } else {
        q = q.eq("is_south_indian", true);
        if (catFilter) q = q.eq("category", catFilter);
      }
      const { data } = await q;
      const items = data ?? [];
      setResults(items);
      // keep foodMap updated so we can look up checked items by id
      setFoodMap(prev => {
        const next = { ...prev };
        items.forEach(f => { next[f.id] = f; });
        return next;
      });
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, catFilter, activeSlot]);

  // ── Checkbox toggle ───────────────────────────────────────────
  function toggle(food: FoodItem) {
    setFoodMap(prev => ({ ...prev, [food.id]: food }));
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(food.id)) { next.delete(food.id); }
      else { next.add(food.id); }
      return next;
    });
  }

  // ── Proceed to qty step ───────────────────────────────────────
  function goToQty() {
    // initialise quantities for newly checked items
    const init: Record<string, number> = {};
    checked.forEach(id => {
      const food = foodMap[id];
      if (!food) return;
      init[id] = quantities[id] ?? (MIN_QTY[food.serving_unit] ?? 1);
    });
    setQties(init);
    setStep("qty");
  }

  function adjustQty(id: string, delta: number) {
    const food = foodMap[id];
    if (!food) return;
    const s = STEP[food.serving_unit] ?? 1;
    const min = MIN_QTY[food.serving_unit] ?? s;
    setQties(prev => ({
      ...prev,
      [id]: Math.max(min, Math.round(((prev[id] ?? min) + delta * s) * 10) / 10),
    }));
  }

  // ── Panel open/close ──────────────────────────────────────────
  function openSlot(slot: Slot) {
    setActiveSlot(slot);
    setStep("select");
    setQuery(""); setCatFilter("");
    setChecked(new Set()); setQties({});
    setPoolItems([]);
    setManualName(""); setManualCal("");
    setManualQty("1"); setManualUnit("serving"); setManualNote("");
    setManualSlot(slot === "other" ? "other" : slot);
    clearPhoto();
    loadPoolForSlot(slot, kutumbhId);
  }

  function closePanel() {
    setActiveSlot(null);
    setStep("select");
    setChecked(new Set());
  }

  // ── Save ──────────────────────────────────────────────────────
  async function saveItems() {
    if (!checked.size || !activeSlot || !userId) return;
    setSaving(true);
    const rows = Array.from(checked).map(id => {
      const food = foodMap[id];
      const qty  = quantities[id] ?? (MIN_QTY[food.serving_unit] ?? 1);
      const g    = toGrams(qty, food);
      return {
        user_id: userId, food_item_id: food.id, food_name: food.name,
        meal_slot: activeSlot, quantity_g: qty, quantity_unit: food.serving_unit,
        calories:  calcCal(food, g),
        protein_g: food.protein_g != null ? Math.round((food.protein_g * g) / 100 * 10) / 10 : null,
        logged_date: today,
      };
    });
    await supabase.from("meal_logs").insert(rows);
    setSaving(false);
    closePanel();
    loadLogs();
  }

  async function saveManual() {
    if (!manualName.trim() || !userId) return;
    setSaving(true);

    await supabase.from("meal_logs").insert({
      user_id:       userId,
      food_name:     manualName.trim(),
      meal_slot:     manualSlot,
      quantity_g:    parseFloat(manualQty) || 1,
      quantity_unit: manualUnit,
      calories:      manualCal ? parseFloat(manualCal) : null,
      notes:         manualNote || null,
      logged_date:   today,
    });
    setSaving(false);
    closePanel();
    loadLogs();
  }

  async function deleteLog(id: string) {
    await supabase.from("meal_logs").delete().eq("id", id);
    loadLogs();
  }

  function startEdit(log: MealLog) {
    setEditingId(log.id);
    setEditName(log.food_name);
    setEditQty(String(log.quantity_g));
    setEditUnit(log.quantity_unit ?? "serving");
  }

  function cancelEdit() { setEditingId(null); }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("meal_logs")
      .update({
        food_name:     editName.trim(),
        quantity_g:    parseFloat(editQty) || 1,
        quantity_unit: editUnit,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    setEditingId(null);
    loadLogs();
  }

  const totalCal = logs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const logsFor  = (slot: Slot) => logs.filter(l => l.meal_slot === slot);

  const checkedList = Array.from(checked)
    .map(id => foodMap[id])
    .filter(Boolean) as FoodItem[];

  const qtyPreviewCal = checkedList.reduce((s, food) => {
    const qty = quantities[food.id] ?? (MIN_QTY[food.serving_unit] ?? 1);
    return s + (calcCal(food, toGrams(qty, food)) ?? 0);
  }, 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#F6F5EE" }}>

      {/* Header */}
      <header style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 70%, #3D6638 100%)" }}>
        <div className="px-5 py-4">
          <PageNav />
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
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
          const slotLogs  = logsFor(key);
          const slotCal   = slotLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
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
                    >
                      {isCollapsed ? "+" : "−"}
                    </button>
                  )}
                  <button onClick={() => openSlot(key)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: "#EAF2E8", color: "#4A7C44" }}>✎</button>
                </div>
              </div>
              {slotLogs.length > 0 && !isCollapsed && (
                <div style={{ borderTop: "1px solid #F0EFE8" }}>
                  {slotLogs.map(log => (
                    <div key={log.id} style={{ borderBottom: "1px solid #F6F5EE" }}>

                      {editingId === log.id ? (
                        /* ── Edit mode ── */
                        <div className="px-4 py-3 space-y-2">
                          {/* Name */}
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            className="w-full rounded-xl px-3 py-2 text-sm"
                            style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
                          />
                          {/* Qty + unit */}
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
                              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none", appearance: "none" as const }}>
                              <option value="serving">serving</option>
                              <option value="piece">piece(s)</option>
                              <option value="bowl">bowl</option>
                              <option value="cup">cup</option>
                              <option value="glass">glass</option>
                              <option value="tbsp">tbsp</option>
                              <option value="g">grams</option>
                            </select>
                          </div>
                          {/* Save / Cancel */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveEdit} disabled={saving || !editName.trim()}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                              style={{ background: "#1C2B1C" }}>
                              {saving ? "Saving…" : "Save ✓"}
                            </button>
                            <button onClick={cancelEdit}
                              className="px-4 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: "#F0EFE8", color: "#5A6055" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Read mode ── */
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: "#1C201C" }}>{log.food_name}</p>
                            <p className="text-xs" style={{ color: "#8A9085" }}>
                              {log.quantity_g} {log.quantity_unit ?? "serving"}
                              {log.calories  != null ? ` · ${log.calories} kcal`      : ""}
                              {log.protein_g != null ? ` · ${log.protein_g}g protein` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            <button onClick={() => startEdit(log)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg"
                              style={{ background: "#EAF2E8" }}>
                              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                                <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#4A7C44" strokeWidth="1.5" strokeLinejoin="round"/>
                                <path d="M7.5 3L10 5.5" stroke="#4A7C44" strokeWidth="1.5"/>
                              </svg>
                            </button>
                            <button onClick={() => deleteLog(log.id)}
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

      {/* ══ Slide-up panel ══ */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.4)" }}>
          <button className="flex-1" onClick={closePanel} />
          <div className="rounded-t-3xl flex flex-col" style={{ background: "#F6F5EE", maxHeight: "90vh" }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0"
              style={{ borderBottom: "1px solid #E2E1D8" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8A9085" }}>
                  {step === "select" ? "Select items for" : "Set quantities for"}
                </p>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#1C201C" }}>
                  {SLOTS.find(s => s.key === activeSlot)?.label}
                </h2>
              </div>
              <button onClick={closePanel}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: "#E2E1D8", color: "#5A6055" }}>✕</button>
            </div>

            {/* ── OTHER: photo + manual entry ── */}
            {activeSlot === "other" ? (
              <div className="overflow-y-auto px-5 py-4 space-y-4">

                {/* ── Meal time selector ── */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8A9085" }}>
                    Which meal?
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { key: "breakfast", icon: "☀️",  label: "Breakfast" },
                      { key: "lunch",     icon: "🌤️", label: "Lunch"     },
                      { key: "dinner",    icon: "🌙",  label: "Dinner"    },
                      { key: "other",     icon: "＋",  label: "Other"     },
                    ] as { key: Slot; icon: string; label: string }[]).map(s => (
                      <button key={s.key}
                        onClick={() => setManualSlot(s.key)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
                        style={{
                          background: manualSlot === s.key ? "#1C2B1C" : "#fff",
                          border: `1.5px solid ${manualSlot === s.key ? "#1C2B1C" : "#E2E1D8"}`,
                        }}>
                        <span className="text-lg leading-none">{s.icon}</span>
                        <span className="text-[10px] font-semibold leading-tight"
                          style={{ color: manualSlot === s.key ? "#fff" : "#5A6055" }}>
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Food name */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#8A9085" }}>
                    Item name
                  </label>
                  <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                    placeholder="e.g. Avial, Lemon Rice, Biryani…"
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                </div>

                {/* Qty + Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#8A9085" }}>Quantity</label>
                    <input type="number" min="0.5" step="0.5" value={manualQty}
                      onChange={e => setManualQty(e.target.value)}
                      className="w-full rounded-xl px-3 py-3 text-sm"
                      style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#8A9085" }}>Unit</label>
                    <select value={manualUnit} onChange={e => setManualUnit(e.target.value)}
                      className="w-full rounded-xl px-3 py-3 text-sm"
                      style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none", appearance: "none" as const }}>
                      <option value="serving">serving</option>
                      <option value="piece">piece(s)</option>
                      <option value="bowl">bowl</option>
                      <option value="cup">cup</option>
                      <option value="glass">glass</option>
                      <option value="tbsp">tbsp</option>
                      <option value="g">grams</option>
                    </select>
                  </div>
                </div>

                {/* Calories */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#8A9085" }}>
                    Approx. calories <span style={{ color: "#A0A89A" }}>(optional)</span>
                  </label>
                  <input type="number" min="0" value={manualCal} onChange={e => setManualCal(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#8A9085" }}>
                    Notes <span style={{ color: "#A0A89A" }}>(optional)</span>
                  </label>
                  <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)}
                    placeholder="e.g. restaurant, light oil, leftovers…"
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                </div>

                <button onClick={saveManual} disabled={saving || !manualName.trim()}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                  style={{ background: "#4A7C44" }}>
                  {saving ? "Saving…" : "Log this item ✓"}
                </button>

                {/* Bottom padding so last button clears the nav */}
                <div style={{ height: "8px" }} />
              </div>

            ) : step === "select" ? (
              /* ── STEP 1: CHECKBOX SELECTION ── */
              <div className="flex flex-col overflow-hidden">

                {/* ── Pool items from today's plan ── */}
                {poolItems.length > 0 && (
                  <div className="shrink-0 px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#4A7C44" }}>
                      From today&apos;s plan
                    </p>
                    <div className="space-y-1.5">
                      {poolItems.map(item => {
                        const fakeId = item.foodItemId ?? `pool-${item.planId}`;
                        const isChecked = checked.has(fakeId);
                        const food = foodMap[fakeId];
                        return (
                          <button
                            key={item.planId}
                            onClick={() => food && toggle(food)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                            style={{
                              background: isChecked ? "#EAF2E8" : "#fff",
                              border: `1.5px solid ${isChecked ? "#4A7C44" : "#E2E1D8"}`,
                            }}
                          >
                            <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                              style={{
                                background: isChecked ? "#4A7C44" : "#fff",
                                border: `2px solid ${isChecked ? "#4A7C44" : "#C8C5BA"}`,
                              }}>
                              {isChecked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: isChecked ? "#1C201C" : "#5A6055" }}>
                                {item.foodName}
                              </p>
                              {item.caloriesPerServing != null && (
                                <p className="text-xs" style={{ color: "#4A7C44" }}>
                                  ~{item.caloriesPerServing} kcal · {item.servingWeightG}g per serving
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                      <span className="text-xs" style={{ color: "#8A9085" }}>or search for more</span>
                      <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                    </div>
                  </div>
                )}

                {/* Category tabs */}
                <div className="shrink-0 px-4 pt-3 pb-2">
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {CAT_TABS.map(tab => (
                      <button key={tab.key}
                        onClick={() => { setCatFilter(tab.key); setQuery(""); }}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          background: catFilter === tab.key ? "#1C2B1C" : "#E2E1D8",
                          color: catFilter === tab.key ? "#fff" : "#5A6055",
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div className="shrink-0 px-4 pb-2">
                  <input type="search" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search food…"
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                    style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }} />
                </div>

                {/* Food list with checkboxes */}
                <div className="overflow-y-auto px-4 space-y-1.5" style={{ minHeight: 0, paddingBottom: checked.size ? "80px" : "20px" }}>
                  {searching && <p className="text-xs text-center py-4" style={{ color: "#8A9085" }}>Loading…</p>}
                  {!searching && results.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "#8A9085" }}>No items found</p>
                  )}
                  {!searching && results.map(food => {
                    const isChecked = checked.has(food.id);
                    return (
                      <button key={food.id} onClick={() => toggle(food)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left"
                        style={{
                          background: isChecked ? "#EAF2E8" : "#fff",
                          border: `1.5px solid ${isChecked ? "#4A7C44" : "#E2E1D8"}`,
                        }}>
                        {/* Checkbox */}
                        <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                          style={{
                            background: isChecked ? "#4A7C44" : "#fff",
                            border: `2px solid ${isChecked ? "#4A7C44" : "#C8C5BA"}`,
                          }}>
                          {isChecked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-lg shrink-0">{CAT_ICON[food.category] ?? "🍽️"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#1C201C" }}>{food.name}</p>
                          <p className="text-xs truncate" style={{ color: "#8A9085" }}>
                            {food.name_ta ? `${food.name_ta} · ` : ""}
                            per {food.serving_weight_g}g · {food.calories ?? "—"} kcal/100g
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {/* ── Ate outside? Photo section ── */}
                  <div className="pt-2 pb-4">
                    {/* Hidden file inputs */}
                    <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
                      onChange={handlePhotoChange} className="hidden" />
                    <input ref={galleryRef} type="file" accept="image/*"
                      onChange={handlePhotoChange} className="hidden" />

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                      <span className="text-xs" style={{ color: "#8A9085" }}>ate outside?</span>
                      <div className="flex-1 h-px" style={{ background: "#E2E1D8" }} />
                    </div>

                    {/* Photo preview */}
                    {photoPreview && (
                      <div className="mb-3">
                        <div className="relative rounded-2xl overflow-hidden"
                          style={{ background: "#1C201C", minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoPreview} alt="Food photo"
                            style={{ width: "100%", maxHeight: "220px", objectFit: "contain", display: "block" }} />
                          <button onClick={clearPhoto}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>✕</button>
                        </div>
                        <div className="flex gap-4 justify-center mt-2">
                          <button onClick={() => cameraRef.current?.click()}
                            className="text-xs font-medium" style={{ color: "#4A7C44" }}>📷 Retake</button>
                          <button onClick={() => galleryRef.current?.click()}
                            className="text-xs font-medium" style={{ color: "#4A7C44" }}>🖼️ Change</button>
                        </div>
                      </div>
                    )}

                    {/* Capture buttons — shown when no photo yet */}
                    {!photoPreview && !analyzing && !aiSuggestions && (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => cameraRef.current?.click()}
                          className="flex flex-col items-center gap-2 py-5 rounded-2xl"
                          style={{ background: "#fff", border: "1.5px dashed #C5DFC2" }}>
                          <span className="text-2xl">📷</span>
                          <span className="text-xs font-medium" style={{ color: "#4A7C44" }}>Take Photo</span>
                        </button>
                        <button onClick={() => galleryRef.current?.click()}
                          className="flex flex-col items-center gap-2 py-5 rounded-2xl"
                          style={{ background: "#fff", border: "1.5px dashed #C5DFC2" }}>
                          <span className="text-2xl">🖼️</span>
                          <span className="text-xs font-medium" style={{ color: "#4A7C44" }}>From Gallery</span>
                        </button>
                      </div>
                    )}

                    {/* Analysing spinner */}
                    {analyzing && (
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                        style={{ background: "#EAF2E8", border: "1px solid #C5DFC2" }}>
                        <span className="text-base animate-spin" style={{ display: "inline-block" }}>🔄</span>
                        <span className="text-sm font-medium" style={{ color: "#4A7C44" }}>Identifying dishes…</span>
                      </div>
                    )}

                    {/* AI identified items */}
                    {aiSuggestions && aiSuggestions.length > 0 && !analyzing && (
                      <div className="rounded-2xl overflow-hidden"
                        style={{ border: "1.5px solid #C5DFC2", background: "#F0F7EF" }}>
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
                              <div className="flex items-center gap-3 px-4 py-2.5"
                                style={{ background: isOn ? "#EAF2E8" : "#fff" }}>
                                <button
                                  onClick={() => { const n = new Set(aiChecked); isOn ? n.delete(item) : n.add(item); setAiChecked(n); }}
                                  className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                                  style={{ background: isOn ? "#4A7C44" : "#fff", border: `2px solid ${isOn ? "#4A7C44" : "#B0C4AE"}` }}>
                                  {isOn && <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                                <input id={`ai-${i}`} type="text" value={aiEdits[item] ?? item}
                                  onChange={e => setAiEdits(p => ({ ...p, [item]: e.target.value }))}
                                  className="flex-1 text-sm font-medium bg-transparent rounded-lg px-2 py-1"
                                  style={{ color: isOn ? "#1C2B1C" : "#8A9085", border: "1.5px solid transparent", outline: "none", minWidth: 0 }}
                                  onFocus={e => (e.target.style.border = "1.5px solid #4A7C44")}
                                  onBlur={e  => (e.target.style.border = "1.5px solid transparent")} />
                                <label htmlFor={`ai-${i}`}
                                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                                  style={{ background: "#EAF2E8" }}>
                                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                    <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#4A7C44" strokeWidth="1.5" strokeLinejoin="round"/>
                                    <path d="M7.5 3L10 5.5" stroke="#4A7C44" strokeWidth="1.5"/>
                                  </svg>
                                </label>
                              </div>
                              <div className="flex items-center gap-2 px-4 pb-3"
                                style={{ background: isOn ? "#EAF2E8" : "#fff" }}>
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
                                  {["serving","piece","bowl","cup","glass","tbsp","g"].map(u => <option key={u} value={u}>{u}</option>)}
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
                          <button onClick={saveAiItems}
                            disabled={saving || aiChecked.size === 0}
                            className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                            style={{ background: "#1C2B1C" }}>
                            {saving ? "Saving…" : aiChecked.size === 0 ? "Select at least one item"
                              : `Log ${aiChecked.size} item${aiChecked.size > 1 ? "s" : ""} ✓`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sticky bottom bar when items are selected */}
                {checked.size > 0 && (
                  <div className="shrink-0 absolute bottom-0 left-0 right-0 px-4 py-4 rounded-b-3xl"
                    style={{ background: "#F6F5EE", borderTop: "1px solid #E2E1D8" }}>
                    <button onClick={goToQty}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                      style={{ background: "#1C2B1C" }}>
                      Set quantities for {checked.size} item{checked.size > 1 ? "s" : ""} →
                    </button>
                  </div>
                )}
              </div>

            ) : (
              /* ── STEP 2: SET QUANTITIES ── */
              <div className="flex flex-col overflow-hidden">
                <div className="overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0, paddingBottom: "80px" }}>
                  <p className="text-xs" style={{ color: "#8A9085" }}>
                    Adjust quantity for each item, then tap Log.
                  </p>
                  {checkedList.map(food => {
                    const qty = quantities[food.id] ?? (MIN_QTY[food.serving_unit] ?? 1);
                    const g   = toGrams(qty, food);
                    const cal = calcCal(food, g);
                    return (
                      <div key={food.id} className="rounded-2xl px-4 py-3"
                        style={{ background: "#fff", border: "1px solid #E2E1D8" }}>
                        {/* Food name row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{CAT_ICON[food.category] ?? "🍽️"}</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: "#1C201C" }}>{food.name}</p>
                            {cal != null && (
                              <p className="text-xs" style={{ color: "#4A7C44" }}>
                                {qtyLabel(qty, food.serving_unit)} ≈ {g}g · {cal} kcal
                              </p>
                            )}
                          </div>
                          <button onClick={() => { setChecked(prev => { const n = new Set(prev); n.delete(food.id); return n; }); }}
                            className="text-xs w-5 h-5 flex items-center justify-center"
                            style={{ color: "#8A9085" }}>✕</button>
                        </div>
                        {/* Ingredients / Preparation reference */}
                        {(food.ingredients || food.preparation) && (
                          <div className="rounded-xl px-3 py-2 mb-3 space-y-1"
                            style={{ background: "#F6F5EE", border: "1px solid #E2E1D8" }}>
                            {food.ingredients && (
                              <p className="text-xs leading-snug" style={{ color: "#5A6055" }}>
                                <span className="font-semibold" style={{ color: "#8A9085" }}>Ingredients: </span>
                                {food.ingredients}
                              </p>
                            )}
                            {food.preparation && (
                              <p className="text-xs leading-snug" style={{ color: "#5A6055" }}>
                                <span className="font-semibold" style={{ color: "#8A9085" }}>Prep: </span>
                                {food.preparation}
                              </p>
                            )}
                          </div>
                        )}
                        {/* Stepper + quick-pick */}
                        <div className="flex items-center gap-3">
                          <button onClick={() => adjustQty(food.id, -1)}
                            className="w-9 h-9 rounded-full text-lg font-bold flex items-center justify-center"
                            style={{ background: "#EAF2E8", color: "#2E5C28" }}>−</button>
                          <div className="flex-1 text-center">
                            <p className="text-xl font-bold" style={{ color: "#1C201C" }}>
                              {qty % 1 === 0 ? qty : qty}
                            </p>
                            <p className="text-xs" style={{ color: "#8A9085" }}>
                              {UNIT_LABEL[food.serving_unit] ?? food.serving_unit}
                            </p>
                          </div>
                          <button onClick={() => adjustQty(food.id, 1)}
                            className="w-9 h-9 rounded-full text-lg font-bold flex items-center justify-center"
                            style={{ background: "#EAF2E8", color: "#2E5C28" }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sticky bottom */}
                <div className="shrink-0 absolute bottom-0 left-0 right-0 px-4 py-4 rounded-b-3xl"
                  style={{ background: "#F6F5EE", borderTop: "1px solid #E2E1D8" }}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button onClick={() => setStep("select")}
                      className="text-sm font-medium"
                      style={{ color: "#5A6055" }}>← Back</button>
                    <p className="text-sm font-semibold" style={{ color: "#4A7C44" }}>
                      {qtyPreviewCal > 0 ? `${qtyPreviewCal} kcal total` : ""}
                    </p>
                  </div>
                  <button onClick={saveItems} disabled={saving || checked.size === 0}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                    style={{ background: "#1C2B1C" }}>
                    {saving ? "Saving…" : `Log ${checked.size} item${checked.size > 1 ? "s" : ""} ✓`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
