"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";

type T = { name: string; blurb: string | null; ingredients: string[]; method: string[]; status: string };

/** The Key Member checks a translated recipe: fix any line, then mark it as checked. */
export default function TranslationEditor({ recipeId, lang, userId, t }: { recipeId: number; lang: string; userId: string; t: T }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(t.name);
  const [blurb, setBlurb] = useState(t.blurb ?? "");
  const [ing, setIng] = useState(t.ingredients.join("\n"));
  const [met, setMet] = useState(t.method.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  async function save(status: "draft" | "checked") {
    if (busy || !name.trim()) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("recipe_translations").update({
      name: name.trim(), blurb: blurb.trim() || null, ingredients: lines(ing), method: lines(met),
      status, updated_by: userId, updated_at: new Date().toISOString(),
    }).eq("recipe_id", recipeId).eq("lang", lang);
    setBusy(false);
    if (error) { setMsg("Could not save. Please try again."); return; }
    window.location.reload();
  }

  const field = "w-full rounded-xl px-3 py-2 text-base";
  return (
    <section data-print-hide className="rounded-2xl px-4 py-3 grid gap-2" style={look(FAMILY.violet)}>
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen(true)} className="px-4 rounded-full text-sm font-semibold"
            style={{ minHeight: 44, border: `1.5px solid ${B.violetLink}`, color: B.violetLink, background: "#fff" }}>Correct this translation</button>
          {t.status !== "checked" && (
            <button onClick={() => save("checked")} disabled={busy} className="px-4 rounded-full text-sm font-semibold text-white disabled:opacity-60"
              style={{ minHeight: 44, background: B.button }}>{busy ? "Saving…" : "Mark as checked"}</button>
          )}
          {msg && <span className="text-xs" style={{ color: "#B42318" }}>{msg}</span>}
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="text-xs font-semibold" htmlFor="tr-name" style={{ color: B.muted2 }}>Name</label>
          <input id="tr-name" lang={lang} value={name} onChange={(e) => setName(e.target.value)} className={field} style={fieldLook(FAMILY.violet)} />
          <label className="text-xs font-semibold" htmlFor="tr-blurb" style={{ color: B.muted2 }}>About</label>
          <textarea id="tr-blurb" lang={lang} rows={2} value={blurb} onChange={(e) => setBlurb(e.target.value)} className={field} style={fieldLook(FAMILY.violet)} />
          <label className="text-xs font-semibold" htmlFor="tr-ing" style={{ color: B.muted2 }}>What goes in · one line each</label>
          <textarea id="tr-ing" lang={lang} rows={8} value={ing} onChange={(e) => setIng(e.target.value)} className={field} style={fieldLook(FAMILY.violet)} />
          <label className="text-xs font-semibold" htmlFor="tr-met" style={{ color: B.muted2 }}>How it&apos;s made · one step per line</label>
          <textarea id="tr-met" lang={lang} rows={8} value={met} onChange={(e) => setMet(e.target.value)} className={field} style={fieldLook(FAMILY.violet)} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save("checked")} disabled={busy} className="px-4 rounded-full text-sm font-semibold text-white disabled:opacity-60"
              style={{ minHeight: 44, background: B.button }}>{busy ? "Saving…" : "Save and mark as checked"}</button>
            <button onClick={() => save("draft")} disabled={busy} className="px-4 rounded-full text-sm font-semibold disabled:opacity-60"
              style={{ minHeight: 44, border: `1.5px solid ${B.violetLink}`, color: B.violetLink, background: "#fff" }}>Save as draft</button>
            <button onClick={() => setOpen(false)} className="px-3 text-sm font-semibold" style={{ minHeight: 44, color: B.violetLink }}>Cancel</button>
          </div>
          {msg && <p className="text-xs m-0" style={{ color: "#B42318" }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}
