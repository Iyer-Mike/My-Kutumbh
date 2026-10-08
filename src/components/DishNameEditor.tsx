"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";
import { langOf } from "@/lib/languages";

/** Any member of the family can write or correct a dish's name in their language. */
export default function DishNameEditor({ foodItemId, kutumbhId, userId, lang, current }: {
  foodItemId: string; kutumbhId: string; userId: string; lang: string; current: string | null;
}) {
  const supabase = createClient();
  const l = langOf(lang);
  const [name, setName] = useState(current ?? "");
  const [saved, setSaved] = useState(current ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!l) return null;

  async function save() {
    const v = name.trim();
    if (busy || v === saved) { setOpen(false); return; }
    setBusy(true); setMsg(null);
    const { error } = v
      ? await supabase.from("dish_names").upsert(
          { food_item_id: foodItemId, kutumbh_id: kutumbhId, lang, name: v, updated_by: userId, updated_at: new Date().toISOString() },
          { onConflict: "food_item_id,kutumbh_id,lang" })
      : await supabase.from("dish_names").delete().eq("food_item_id", foodItemId).eq("kutumbh_id", kutumbhId).eq("lang", lang);
    setBusy(false);
    if (error) { setMsg("Could not save. Please try again."); return; }
    setSaved(v); setOpen(false);
    window.location.reload();
  }

  return (
    <div className="rounded-xl px-3 py-2" style={look(FAMILY.violet)}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm font-semibold text-left w-full" style={{ color: B.violetLink, minHeight: 44 }}>
          {saved ? `Correct the ${l.name} name` : `Add the name in ${l.name}`}
        </button>
      ) : (
        <div className="grid gap-2">
          <label htmlFor="dish-name-local" className="text-xs font-semibold" style={{ color: B.muted2 }}>Name in {l.native} ({l.name})</label>
          <input id="dish-name-local" lang={lang} value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-base" style={fieldLook(FAMILY.violet)} />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-4 rounded-full text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: B.button, minHeight: 44 }}>{busy ? "Saving…" : "Save"}</button>
            <button onClick={() => { setName(saved); setOpen(false); }} className="px-3 text-sm font-semibold" style={{ color: B.violetLink, minHeight: 44 }}>Cancel</button>
          </div>
          {msg && <p className="text-xs m-0" style={{ color: "#B42318" }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
