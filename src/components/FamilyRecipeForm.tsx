"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";
import { CUISINES, DIETS } from "@/lib/food-taxonomy";

/**
 * A family recipe is written in the same shape as every other recipe:
 * serves, prep, cooking, a line about the dish, a tip, what goes in, how
 * it is made. Nutrition comes from the dish itself, so it is not asked for.
 */
export default function FamilyRecipeForm({
  dishId, dishName, cuisine, diet, isPrime,
}: { dishId: string; dishName: string; cuisine: string | null; diet: string | null; isPrime: boolean }) {
  const router = useRouter();
  const supabase = createClient();

  const [cuisineKey, setCuisine] = useState(cuisine ?? "south_indian");
  const [dietKey, setDiet]       = useState(diet ?? "veg");
  const [jain, setJain]          = useState(false);
  const [serves, setServes]      = useState("");
  const [prep, setPrep]          = useState("");
  const [cook, setCook]          = useState("");
  const [blurb, setBlurb]        = useState("");
  const [tip, setTip]            = useState("");
  const [ingredients, setIng]    = useState("");
  const [method, setMethod]      = useState("");
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState<string | null>(null);

  const lines = (t: string) => t.split("\n").map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  const ready = lines(ingredients).length > 0 && lines(method).length > 0;

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("submit_family_recipe", {
      p_food_item_id: dishId,
      p: {
        cuisine: cuisineKey, diet: dietKey, is_jain: jain,
        serves: serves.trim(), prep_time: prep.trim(), cook_time: cook.trim(),
        blurb: blurb.trim(), tip: tip.trim(),
        ingredients: lines(ingredients), method: lines(method),
      },
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.replace(`/recipes/${data}`);
  }

  const field = "w-full rounded-xl px-3 py-2.5 text-sm";
  const fieldStyle = { background: B.field, border: `1.5px solid ${B.cardEdge}`, color: B.ink, outline: "none" } as const;
  const label = "text-[11px] font-semibold uppercase tracking-wide";

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl px-4 py-4 grid gap-3" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1">
            <span className={label} style={{ color: B.muted2 }}>Serves</span>
            <input className={field} style={fieldStyle} value={serves} onChange={(e) => setServes(e.target.value)} placeholder="4" />
          </label>
          <label className="grid gap-1">
            <span className={label} style={{ color: B.muted2 }}>Prep</span>
            <input className={field} style={fieldStyle} value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="10 min" />
          </label>
          <label className="grid gap-1">
            <span className={label} style={{ color: B.muted2 }}>Cooking</span>
            <input className={field} style={fieldStyle} value={cook} onChange={(e) => setCook(e.target.value)} placeholder="20 min" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className={label} style={{ color: B.muted2 }}>Cuisine</span>
            <select className={field} style={fieldStyle} value={cuisineKey} onChange={(e) => setCuisine(e.target.value)}>
              {CUISINES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className={label} style={{ color: B.muted2 }}>Diet</span>
            <select className={field} style={fieldStyle} value={dietKey} onChange={(e) => setDiet(e.target.value)}>
              {DIETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: B.ink2, minHeight: 44 }}>
          <input type="checkbox" checked={jain} onChange={(e) => setJain(e.target.checked)} />
          Jain-friendly
        </label>
        <label className="grid gap-1">
          <span className={label} style={{ color: B.muted2 }}>About this dish (one line)</span>
          <input className={field} style={fieldStyle} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
        </label>
      </section>

      <section className="rounded-2xl px-4 py-4 grid gap-2" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>What goes in</h2>
        <p className="text-[11px]" style={{ color: B.muted2 }}>One ingredient per line, with the amount: 1 cup toor dal</p>
        <textarea className={field} style={{ ...fieldStyle, minHeight: 130 }} value={ingredients} onChange={(e) => setIng(e.target.value)} />
      </section>

      <section className="rounded-2xl px-4 py-4 grid gap-2" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>How it&apos;s made</h2>
        <p className="text-[11px]" style={{ color: B.muted2 }}>One step per line. The numbers are added for you.</p>
        <textarea className={field} style={{ ...fieldStyle, minHeight: 160 }} value={method} onChange={(e) => setMethod(e.target.value)} />
        <label className="grid gap-1 mt-1">
          <span className={label} style={{ color: B.muted2 }}>Tip (optional)</span>
          <input className={field} style={fieldStyle} value={tip} onChange={(e) => setTip(e.target.value)} />
        </label>
      </section>

      <p className="text-[11px] px-1" style={{ color: B.muted2 }}>
        Nutrition for {dishName} comes from the dish itself and is marked as estimated.
        {isPrime ? " As Prime Member, your recipe is shown to the family at once." : " The Prime Member approves it before the family sees it."}
      </p>

      {error && <p className="text-xs px-1" style={{ color: "#B42318" }}>{error}</p>}

      <button
        onClick={save} disabled={!ready || saving}
        className="w-full rounded-2xl text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: B.button, minHeight: 48 }}
      >
        {saving ? "Saving…" : isPrime ? "Save recipe" : "Send for approval"}
      </button>
    </div>
  );
}
