"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Remove a bill from the spending record (the shelf is not touched). Asks first. */
export default function DeleteBill({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy || !confirm(`Remove ${label} from your spending?\n\nThe shelf is not changed. This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await createClient().from("bills").delete().eq("id", id);
    setBusy(false);
    if (error) { alert(`Couldn't remove it: ${error.message}`); return; }
    router.refresh();
  }
  return <button onClick={remove} disabled={busy} className="text-xs underline disabled:opacity-50" style={{ color: "#8A1C12" }}>{busy ? "Removing…" : "Remove this bill"}</button>;
}
