"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look } from "@/lib/brand";

/** Shown on a family recipe that is still waiting for the Key Member. */
export default function RecipeApproval({ recipeId, canApprove }: { recipeId: number; canApprove: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc("approve_family_recipe", { p_recipe_id: recipeId });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Remove this recipe?")) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc("delete_family_recipe", { p_recipe_id: recipeId });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.replace("/recipes");
  }

  return (
    <section data-print-hide className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.gold)}>
      <p className="text-sm" style={{ color: "#7A5A06" }}>
        {canApprove
          ? "Awaiting your approval · then visible to the family."
          : "Awaiting Key Member approval · then visible to the family."}
      </p>
      <div className="flex gap-2">
        {canApprove && (
          <button onClick={approve} disabled={busy}
            className="flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: B.button, minHeight: 44 }}>
            Approve
          </button>
        )}
        <button onClick={remove} disabled={busy}
          className="rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ background: "#fff", color: "#B42318", border: "1px solid #F1C0BB", minHeight: 44 }}>
          Remove
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "#B42318" }}>{error}</p>}
    </section>
  );
}
