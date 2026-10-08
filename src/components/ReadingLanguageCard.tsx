"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";
import { LANGS } from "@/lib/languages";

/** Each member chooses one language to read dish names in, besides English. */
export default function ReadingLanguageCard({ userId, current }: { userId: string; current: string | null }) {
  const supabase = createClient();
  const [lang, setLang] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function choose(next: string) {
    if (next === lang || saving) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({ reading_language: next || null }).eq("id", userId);
    setSaving(false);
    if (error) { setMsg("Could not save. Please try again."); return; }
    setLang(next);
    setMsg("Saved");
  }

  return (
    <section className="rounded-2xl px-5 py-4" style={look(FAMILY.violet)}>
      <label htmlFor="read-lang" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: B.muted2 }}>
        Dish names in
      </label>
      <p className="text-xs mt-1 mb-2" style={{ color: B.muted }}>
        English always shows. Pick one more language to see the family&apos;s names for dishes beside it.
      </p>
      <select id="read-lang" value={lang} onChange={(e) => choose(e.target.value)} disabled={saving}
        className="w-full rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.violet)}>
        <option value="">English only</option>
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native} ({l.name})</option>)}
      </select>
      {msg && <p className="text-xs mt-2" style={{ color: msg === "Saved" ? "#2F7A35" : "#B42318" }}>{msg}</p>}
    </section>
  );
}
