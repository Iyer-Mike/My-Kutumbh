"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";

/**
 * The shared recipes are fixed, so a change is made on the family's own
 * copy. Made once; asking again opens the same copy.
 */
export default function CopyRecipeButton({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("copy_recipe_for_family", { p_recipe_id: recipeId });
    if (err || typeof data !== "number") {
      setError("Could not make the family version. Please try again.");
      setBusy(false);
      return;
    }
    router.push(`/recipes/${data}/edit`);
  }

  return (
    <div data-print-hide className="grid gap-1.5">
      <button onClick={go} disabled={busy}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-center disabled:opacity-60"
        style={{ background: B.card, color: B.violet, border: `1.5px solid ${B.cardEdge}` }}>
        {busy ? "One moment…" : "✎ Make my family's version"}
      </button>
      <p className="text-[11px] text-center m-0" style={{ color: B.muted2 }}>Edits go to your family&apos;s copy; the original stays</p>
      {error && <p className="text-xs text-center m-0" style={{ color: "#B0453A" }}>{error}</p>}
    </div>
  );
}
