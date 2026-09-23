"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND as B } from "@/lib/brand";
import { CUISINES, DISH_TYPES } from "@/lib/food-taxonomy";

/** Search and the same three layers as the menu, kept in the address bar. */
export default function RecipeFilters({ q, cuisine, diet, type }: {
  q: string; cuisine: string; diet: string; type: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(q);

  function go(changes: Record<string, string>) {
    const next = { q: text, cuisine, diet, type, ...changes };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`/recipes?${params.toString()}`);
  }

  const select = { border: `1.5px solid ${B.cardEdge}`, background: "#fff", color: B.ink, outline: "none" } as const;

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <label htmlFor="r-q" className="sr-only">Search recipes</label>
        <input id="r-q" type="search" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go({}); }}
          placeholder="Search a dish…" maxLength={60}
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm"
          style={{ border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink, outline: "none" }} />
        <button onClick={() => go({})} className="px-4 rounded-xl text-sm font-semibold text-white"
          style={{ background: B.button }}>
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="r-cuisine" className="block text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: B.muted2 }}>
            Cuisine
          </label>
          <select id="r-cuisine" value={cuisine} onChange={(e) => go({ cuisine: e.target.value })}
            className="w-full rounded-lg px-2 py-1.5 text-xs" style={select}>
            <option value="indian">Indian (all regions)</option>
            <optgroup label="Indian regions">
              {CUISINES.filter((c) => c.indian).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </optgroup>
            <optgroup label="World">
              {CUISINES.filter((c) => !c.indian).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </optgroup>
            <option value="all">Every cuisine</option>
          </select>
        </div>
        <div>
          <label htmlFor="r-diet" className="block text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: B.muted2 }}>
            Diet
          </label>
          <select id="r-diet" value={diet} onChange={(e) => go({ diet: e.target.value })}
            className="w-full rounded-lg px-2 py-1.5 text-xs" style={select}>
            <option value="vegan">Vegan only</option>
            <option value="veg">Veg (incl. vegan)</option>
            <option value="egg">Veg + Egg</option>
            <option value="nonveg">Everything incl. non-veg</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} role="group" aria-label="Dish type">
        {[{ key: "", label: "All types", icon: "" }, ...DISH_TYPES].map((t) => (
          <button key={t.key || "all"} type="button" onClick={() => go({ type: t.key })}
            aria-pressed={type === t.key}
            className="shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium"
            style={type === t.key ? { background: B.button, color: "#fff" } : { background: B.tint, color: B.violet }}>
            {t.icon ? `${t.icon} ` : ""}{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
