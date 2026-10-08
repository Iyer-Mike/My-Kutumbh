"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";

/**
 * The shared recipes are fixed, so a change is made on a family copy. The
 * Key Member names it for what it now is, so one dish can have many
 * versions: "Barnyard Millet Dosa (Kuthiraivali Dosa)".
 */
export default function CopyRecipeButton({ recipeId, recipeName }: { recipeId: number; recipeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recipeName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    const nm = name.trim();
    if (nm.length < 2 || busy) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("copy_recipe_for_family", { p_recipe_id: recipeId, p_name: nm });
    if (err || typeof data !== "number") {
      setError("Could not make the family version. Please try again.");
      setBusy(false);
      return;
    }
    router.push(`/recipes/${data}/edit`);
  }

  if (!open) {
    return (
      <button data-print-hide onClick={() => setOpen(true)}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-center"
        style={{ background: B.card, color: B.violet, border: `1.5px solid ${B.cardEdge}` }}>
        ✎ Make my family&apos;s version
      </button>
    );
  }

  return (
    <div data-print-hide className="rounded-2xl px-4 py-4 grid gap-2.5" style={{ background: B.card, border: `1.5px solid ${B.cardEdge}` }}>
      <label htmlFor="variant-name" className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: B.muted2 }}>
        Name this version
      </label>
      <input id="variant-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
        placeholder="Barnyard Millet Dosa (Kuthiraivali Dosa)"
        className="w-full rounded-xl px-3 py-2.5 text-sm"
        style={{ background: B.field, border: `1.5px solid ${B.cardEdge}`, color: B.ink, outline: "none" }} />
      <p className="text-[11px] m-0" style={{ color: B.muted2 }}>English name, local name in brackets.</p>
      <div className="flex gap-2">
        <button onClick={go} disabled={busy || name.trim().length < 2}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: B.violet }}>
          {busy ? "One moment…" : "Make it"}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: B.tint, color: B.violet }}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-center m-0" style={{ color: "#B0453A" }}>{error}</p>}
    </div>
  );
}
