"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LANGS } from "@/lib/languages";

const KEY = "mk-recipe-lang";

/** English, or one of the languages the family has begun. The choice is remembered on this phone. */
export default function RecipeLanguageSelect({ current, available }: { current: string | null; available: string[] }) {
  const router = useRouter();
  const path = usePathname();

  // Coming back to a recipe: open it in the language last chosen
  useEffect(() => {
    if (current) return;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && available.includes(saved)) router.replace(`${path}?lang=${saved}`);
    } catch { /* storage blocked: stay in English */ }
  }, [current, available, path, router]);

  function choose(code: string) {
    try { code ? localStorage.setItem(KEY, code) : localStorage.removeItem(KEY); } catch { /* ignore */ }
    router.replace(code ? `${path}?lang=${code}` : path);
  }

  if (available.length === 0) return null;   // English only: nothing to choose

  return (
    <div data-print-hide>
      <label htmlFor="recipe-lang" className="sr-only">Language</label>
      <select id="recipe-lang" value={current && available.includes(current) ? current : ""} onChange={(e) => choose(e.target.value)}
        className="rounded-full px-3 text-sm font-semibold max-w-full"
        style={{ minHeight: 44, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.45)" }}>
        <option value="" style={{ color: "#241238" }}>English</option>
        {LANGS.filter((l) => available.includes(l.code)).map((l) => <option key={l.code} value={l.code} style={{ color: "#241238" }}>{l.native} ({l.name})</option>)}
      </select>
    </div>
  );
}
