"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LANGS } from "@/lib/languages";

const KEY = "mk-recipe-lang";

/** English, or one of the languages the family has begun. The choice is remembered on this phone. */
export default function RecipeLanguageSelect({ current }: { current: string | null }) {
  const router = useRouter();
  const path = usePathname();

  // Coming back to a recipe: open it in the language last chosen
  useEffect(() => {
    if (current) return;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && LANGS.some((l) => l.code === saved)) router.replace(`${path}?lang=${saved}`);
    } catch { /* storage blocked: stay in English */ }
  }, [current, path, router]);

  function choose(code: string) {
    try { code ? localStorage.setItem(KEY, code) : localStorage.removeItem(KEY); } catch { /* ignore */ }
    router.replace(code ? `${path}?lang=${code}` : path);
  }

  return (
    <div data-print-hide>
      <label htmlFor="recipe-lang" className="sr-only">Language</label>
      <select id="recipe-lang" value={current ?? ""} onChange={(e) => choose(e.target.value)}
        className="rounded-full px-3 text-sm font-semibold max-w-full"
        style={{ minHeight: 44, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.45)" }}>
        <option value="" style={{ color: "#241238" }}>English</option>
        {LANGS.map((l) => <option key={l.code} value={l.code} style={{ color: "#241238" }}>{l.native} ({l.name})</option>)}
      </select>
    </div>
  );
}
