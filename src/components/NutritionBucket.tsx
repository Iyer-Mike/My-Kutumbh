"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";

type Item = { id: string; name: string; kind: "recipe" | "dish" };
type Est = {
  id: string; serving_unit: string; serving_weight_g: number; kcal: number; protein_g: number; carbs_g: number;
  fat_g: number; fibre_g: number; iron_mg: number; calcium_mg: number; vit_b12_mcg: number; sodium_mg: number;
};

const FIELDS: { key: keyof Est; label: string }[] = [
  { key: "serving_weight_g", label: "Weight (g)" },
  { key: "kcal", label: "Energy (kcal)" },
  { key: "protein_g", label: "Protein (g)" },
  { key: "carbs_g", label: "Carbs (g)" },
  { key: "fat_g", label: "Fat (g)" },
  { key: "fibre_g", label: "Fibre (g)" },
  { key: "iron_mg", label: "Iron (mg)" },
  { key: "calcium_mg", label: "Calcium (mg)" },
  { key: "vit_b12_mcg", label: "B12 (mcg)" },
  { key: "sodium_mg", label: "Sodium (mg)" },
];

export default function NutritionBucket({ items }: { items: Item[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set(items.slice(0, 10).map((i) => i.id)));
  const [ests, setEsts] = useState<Record<string, Est>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? `Recipe ${id}`;

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else if (n.size < 10) n.add(id);
      return n;
    });
  }

  async function estimate() {
    setBusy(true); setMsg(null);
    try {
      const chosen = items.filter((i) => picked.has(i.id));
      const map: Record<string, Est> = {};
      for (const kind of ["recipe", "dish"] as const) {
        const ids = chosen.filter((i) => i.kind === kind).map((i) => i.id);
        if (!ids.length) continue;
        const res = await fetch(kind === "recipe" ? "/api/estimate-nutrition" : "/api/estimate-dish-nutrition", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "recipe" ? { recipeIds: ids.map(Number) } : { dishIds: ids }),
        });
        const j = await res.json();
        if (!res.ok) { setMsg(j.error ?? "Could not estimate."); break; }
        for (const e of j.estimates as { id: string | number }[]) map[String(e.id)] = { ...(e as unknown as Est), id: String(e.id) };
      }
      setEsts((cur) => ({ ...cur, ...map }));
    } catch { setMsg("Could not reach the estimator. Try again."); }
    finally { setBusy(false); }
  }

  function edit(id: string, key: keyof Est, v: string) {
    const num = Number(v);
    setEsts((s) => ({ ...s, [id]: { ...s[id], [key]: Number.isFinite(num) ? num : 0 } }));
  }

  async function save(id: string) {
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { id: _id, ...n } = ests[id];
    void _id;
    const item = items.find((i) => i.id === id);
    const { error } = item?.kind === "dish"
      ? await supabase.rpc("save_dish_nutrition", { p_food_item_id: id, n })
      : await supabase.rpc("save_family_nutrition", { p_recipe_id: Number(id), n });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setEsts((s) => { const c = { ...s }; delete c[id]; return c; });
    setPicked((p) => { const c = new Set(p); c.delete(id); return c; });
    router.refresh();
  }

  const reviewing = Object.values(ests);

  if (items.length === 0 && reviewing.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: B.muted }}>
        Nothing is waiting. Every family dish has its values, and no recipe is in the bucket.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {msg && <p className="text-sm rounded-xl px-3 py-2" style={{ background: "#FBE9E4", color: "#A23A1E" }}>{msg}</p>}

      {reviewing.map((e) => (
        <div key={e.id} className="rounded-2xl p-4 grid gap-3" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: B.ink }}>{nameOf(e.id)}</p>
            <p className="text-[11px]" style={{ color: B.muted2 }}>
              Estimate for 1 {e.serving_unit}. Change any value, then approve.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="grid gap-0.5 text-[11px]" style={{ color: B.muted }}>
                {f.label}
                <input type="number" inputMode="decimal" min={0} step="any" value={e[f.key] as number}
                  onChange={(ev) => edit(e.id, f.key, ev.target.value)}
                  className="h-11 rounded-xl px-3 text-sm" style={{ border: `1px solid ${B.cardEdge}`, color: B.ink, background: "#fff" }} />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => setEsts((s) => { const c = { ...s }; delete c[e.id]; return c; })}
              className="h-11 px-4 rounded-full text-sm font-semibold" style={{ border: `1.5px solid #3B1F5C`, color: "#3B1F5C", background: "#fff" }}>
              Discard
            </button>
            <button disabled={busy} onClick={() => save(e.id)}
              className="h-11 flex-1 rounded-full text-sm font-semibold text-white" style={{ background: "#3B1F5C" }}>
              Approve and save
            </button>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <div className="rounded-2xl p-4 grid gap-2" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: B.ink }}>Waiting for values ({items.length})</p>
            <button className="text-xs underline min-h-11 px-2" style={{ color: B.muted }}
              onClick={() => setPicked(picked.size ? new Set() : new Set(items.slice(0, 10).map((i) => i.id)))}>
              {picked.size ? "Clear" : "Select up to 10"}
            </button>
          </div>
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 min-h-11">
              <input type="checkbox" className="w-5 h-5" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.name}`} />
              <span className="text-sm flex-1" style={{ color: B.ink }}>{i.name}</span>
              {i.kind === "recipe" ? <Link href={`/recipes/${i.id}`} className="text-xs underline" style={{ color: B.muted }}>View</Link> : <span className="text-[11px]" style={{ color: B.muted2 }}>dish</span>}
            </div>
          ))}
          <button disabled={busy || picked.size === 0} onClick={estimate}
            className="h-12 rounded-full text-sm font-semibold text-white mt-1 disabled:opacity-50" style={{ background: "#3B1F5C" }}>
            {busy ? "Working…" : `Estimate nutrition for ${picked.size}`}
          </button>
          <p className="text-[11px]" style={{ color: B.muted2 }}>Nothing is saved until you approve each estimate.</p>
        </div>
      )}
    </div>
  );
}
