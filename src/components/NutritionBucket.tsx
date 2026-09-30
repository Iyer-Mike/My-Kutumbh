"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";

type Item = { id: number; name: string };
type Est = {
  id: number; serving_unit: string; serving_weight_g: number; kcal: number; protein_g: number; carbs_g: number;
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
  const [picked, setPicked] = useState<Set<number>>(new Set(items.slice(0, 10).map((i) => i.id)));
  const [ests, setEsts] = useState<Record<number, Est>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nameOf = (id: number) => items.find((i) => i.id === id)?.name ?? `Recipe ${id}`;

  function toggle(id: number) {
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
      const res = await fetch("/api/estimate-nutrition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeIds: [...picked] }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Could not estimate."); return; }
      const map: Record<number, Est> = {};
      for (const e of j.estimates as Est[]) map[e.id] = e;
      setEsts(map);
    } catch { setMsg("Could not reach the estimator. Try again."); }
    finally { setBusy(false); }
  }

  function edit(id: number, key: keyof Est, v: string) {
    const num = Number(v);
    setEsts((s) => ({ ...s, [id]: { ...s[id], [key]: Number.isFinite(num) ? num : 0 } }));
  }

  async function save(id: number) {
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { id: _id, ...n } = ests[id];
    void _id;
    const { error } = await supabase.rpc("save_family_nutrition", { p_recipe_id: id, n });
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
        The bucket is empty. Open a family recipe, choose “Edit this recipe” and tick the bucket box to add it.
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
            <p className="text-sm font-semibold" style={{ color: B.ink }}>In the bucket ({items.length})</p>
            <button className="text-xs underline min-h-11 px-2" style={{ color: B.muted }}
              onClick={() => setPicked(picked.size ? new Set() : new Set(items.slice(0, 10).map((i) => i.id)))}>
              {picked.size ? "Clear" : "Select up to 10"}
            </button>
          </div>
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 min-h-11">
              <input type="checkbox" className="w-5 h-5" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.name}`} />
              <span className="text-sm flex-1" style={{ color: B.ink }}>{i.name}</span>
              <Link href={`/recipes/${i.id}`} className="text-xs underline" style={{ color: B.muted }}>View</Link>
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
