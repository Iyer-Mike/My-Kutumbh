"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type PlanItem = {
  id: string;
  food_name: string;
  quantity_g: number;
  quantity_unit: string | null;
};

type FoodSuggestion = {
  id: string;
  name: string;
  calories: number | null;
};

type Props = {
  slotKey: string;
  name: string;
  icon: string;
  time: string;
  userId: string;
  initialItems: PlanItem[];
};

const UNITS = ["serving", "piece", "bowl", "cup", "glass", "tbsp", "g"];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function PlanSlotCard({ slotKey, name, icon, time, userId, initialItems }: Props) {
  const supabase = createClient();
  const [items, setItems]           = useState<PlanItem[]>(initialItems);
  const [adding, setAdding]         = useState(false);
  const [query, setQuery]           = useState("");
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [qty, setQty]               = useState("1");
  const [unit, setUnit]             = useState("serving");
  const [saving, setSaving]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Debounced food search
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("food_items")
        .select("id, name, calories")
        .ilike("name", `%${query.trim()}%`)
        .limit(6);
      setSuggestions(data ?? []);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function openAdd() {
    setAdding(true);
    setQuery("");
    setSuggestions([]);
    setQty("1");
    setUnit("serving");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function cancelAdd() {
    setAdding(false);
    setQuery("");
    setSuggestions([]);
  }

  async function addItem(foodName: string, foodItemId?: string) {
    if (!foodName.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("meal_plans")
      .insert({
        user_id:      userId,
        planned_date: todayISO(),
        meal_slot:    slotKey,
        food_name:    foodName.trim(),
        quantity_g:   parseFloat(qty) || 1,
        quantity_unit: unit,
        food_item_id: foodItemId ?? null,
      })
      .select("id, food_name, quantity_g, quantity_unit")
      .single();
    setSaving(false);
    if (error || !data) return;
    setItems(prev => [...prev, data as PlanItem]);
    cancelAdd();
  }

  async function removeItem(id: string) {
    await supabase.from("meal_plans").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const hasItems = items.length > 0;

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
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: "#1C201C" }}>{name}</p>
            <p className="text-xs mt-0.5" style={{ color: hasItems ? "#4A7C44" : "#8A9085" }}>
              {hasItems ? `${items.length} planned` : `${time} · Nothing planned`}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: "#EAF2E8", color: "#4A7C44" }}
          aria-label="Add dish"
        >
          +
        </button>
      </div>

      {/* Planned items */}
      {hasItems && (
        <div style={{ borderTop: "1px solid #EAF2E8" }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: i > 0 ? "1px solid #F3F2EB" : undefined, background: "#FAFAF8" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4A7C44" }} />
                <p className="text-sm truncate" style={{ color: "#1C201C" }}>{item.food_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <p className="text-xs" style={{ color: "#8A9085" }}>
                  {item.quantity_g} {item.quantity_unit ?? "serving"}
                </p>
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                  style={{ background: "#FEF2F2", color: "#DC2626" }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dish panel */}
      {adding && (
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderTop: "1px solid #EAF2E8", background: "#FAFAF8" }}
        >
          {/* Search input + dropdown */}
          <div className="relative" ref={panelRef}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") cancelAdd();
                if (e.key === "Enter" && suggestions.length === 0 && query.trim()) addItem(query);
              }}
              placeholder="Search or type a dish name…"
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
            />

            {/* Suggestions */}
            {(suggestions.length > 0 || query.trim()) && (
              <div
                className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden"
                style={{ background: "#fff", border: "1px solid #E2E1D8", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => addItem(s.name, s.id)}
                    className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between"
                    style={{ borderBottom: i < suggestions.length - 1 ? "1px solid #F3F2EB" : undefined, color: "#1C201C" }}
                  >
                    <span>{s.name}</span>
                    {s.calories != null && (
                      <span className="text-xs ml-2" style={{ color: "#8A9085" }}>{Math.round(s.calories)} kcal</span>
                    )}
                  </button>
                ))}
                {query.trim() && (
                  <button
                    onClick={() => addItem(query)}
                    className="w-full text-left px-3 py-2.5 text-sm font-semibold"
                    style={{
                      borderTop: suggestions.length > 0 ? "1px solid #EAF2E8" : undefined,
                      color: "#4A7C44",
                      background: "#F7FAF7",
                    }}
                  >
                    Add &ldquo;{query}&rdquo; →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Qty + unit row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(q => String(Math.max(0.5, parseFloat(q) - 0.5)))}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
              style={{ background: "#EAF2E8", color: "#1C2B1C" }}
            >−</button>
            <input
              type="number" min="0.5" step="0.5" value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-16 text-center rounded-lg px-2 py-1.5 text-sm font-semibold"
              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
            />
            <button
              onClick={() => setQty(q => String(parseFloat(q) + 0.5))}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
              style={{ background: "#EAF2E8", color: "#1C2B1C" }}
            >+</button>
            <select
              value={unit} onChange={e => setUnit(e.target.value)}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs"
              style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Confirm / cancel */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => query.trim() && addItem(query)}
              disabled={saving || !query.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: "#1C2B1C" }}
            >
              {saving ? "Adding…" : "Add to plan ✓"}
            </button>
            <button
              onClick={cancelAdd}
              className="px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "#F0EFE8", color: "#5A6055" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
