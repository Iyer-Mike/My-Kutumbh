"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type MealLog = {
  id: string;
  food_name: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
};

type Props = {
  slotKey: string;
  name: string;
  icon: string;
  time: string;
  items: MealLog[];
};

const UNITS = ["serving", "piece", "bowl", "cup", "glass", "tbsp", "g"];

export default function DashboardSlotCard({ slotKey, name, icon, time, items }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const hasItems   = items.length > 0;
  const slotKcal   = items.reduce((s, l) => s + (l.calories ?? 0), 0);
  const [expanded, setExpanded] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editQty,   setEditQty]   = useState("1");
  const [editUnit,  setEditUnit]  = useState("serving");
  const [saving,    setSaving]    = useState(false);

  function startEdit(log: MealLog) {
    setEditingId(log.id);
    setEditName(log.food_name);
    setEditQty(String(log.quantity_g));
    setEditUnit(log.quantity_unit ?? "serving");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const newQty = parseFloat(editQty) || 1;
    const old    = items.find(l => l.id === editingId);
    // Scale kcal with the portion; a unit change can't be converted here
    const scale  = old && old.quantity_g && (old.quantity_unit ?? "serving") === editUnit
      ? { calories: old.calories != null ? Math.round(old.calories * newQty / old.quantity_g) : null }
      : {};
    const { error } = await supabase
      .from("meal_logs")
      .update({
        food_name:     editName.trim(),
        quantity_g:    newQty,
        quantity_unit: editUnit,
        ...scale,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) { alert(`Save failed: ${error.message}`); return; }
    setEditingId(null);
    router.refresh(); // re-run server component to reload fresh data
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
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
              {hasItems
                ? `${items.length} item${items.length > 1 ? "s" : ""}${slotKcal > 0 ? ` · ${Math.round(slotKcal)} kcal` : ""}`
                : `${time} · Nothing logged`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Expand / collapse */}
          {hasItems && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-base font-semibold"
              style={{ background: expanded ? "#1C2B1C" : "#EAF2E8", color: expanded ? "#fff" : "#4A7C44" }}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? "−" : "+"}
            </button>
          )}
          {/* Go to Log — opens this slot's panel directly */}
          <Link
            href={`/log?slot=${slotKey}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: "#EAF2E8", color: "#4A7C44" }}
            aria-label="Log food"
          >
            ✎
          </Link>
        </div>
      </div>

      {/* Expanded item list */}
      {hasItems && expanded && (
        <div style={{ borderTop: "1px solid #EAF2E8" }}>
          {items.map((log, i) => (
            <div
              key={log.id}
              style={{ borderTop: i > 0 ? "1px solid #F3F2EB" : undefined, background: "#FAFAF8" }}
            >
              {editingId === log.id ? (
                /* ── Edit mode ── */
                <div className="px-4 py-3 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ border: "1.5px solid #4A7C44", background: "#fff", color: "#1C201C", outline: "none" }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditQty(q => String(Math.max(0.5, parseFloat(q) - 0.5)))}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                      style={{ background: "#EAF2E8", color: "#1C2B1C" }}
                    >−</button>
                    <input
                      type="number" min="0.5" step="0.5" value={editQty}
                      onChange={e => setEditQty(e.target.value)}
                      className="w-16 text-center rounded-lg px-2 py-1.5 text-sm font-semibold"
                      style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
                    />
                    <button
                      onClick={() => setEditQty(q => String(parseFloat(q) + 0.5))}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                      style={{ background: "#EAF2E8", color: "#1C2B1C" }}
                    >+</button>
                    <select
                      value={editUnit} onChange={e => setEditUnit(e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                      style={{ border: "1.5px solid #E2E1D8", background: "#fff", color: "#1C201C", outline: "none" }}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit} disabled={saving || !editName.trim()}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: "#1C2B1C" }}
                    >
                      {saving ? "Saving…" : "Save ✓"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "#F0EFE8", color: "#5A6055" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read mode ── */
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4A7C44" }} />
                    <p className="text-sm truncate" style={{ color: "#1C201C" }}>{log.food_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <p className="text-xs" style={{ color: "#8A9085" }}>
                      {log.quantity_g} {log.quantity_unit ?? "serving"}
                    </p>
                    {log.calories != null && (
                      <p className="text-xs font-medium" style={{ color: log.nutrition_estimated ? "#A5661A" : "#4A7C44" }}>
                        {log.nutrition_estimated ? `~${Math.round(log.calories)} kcal est.` : `${Math.round(log.calories)} kcal`}
                      </p>
                    )}
                    <button
                      onClick={() => startEdit(log)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg"
                      style={{ background: "#EAF2E8" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                        <path d="M9 1.5L11.5 4L4.5 11H2v-2.5L9 1.5Z" stroke="#4A7C44" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M7.5 3L10 5.5" stroke="#4A7C44" strokeWidth="1.5"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
