"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FestivalRemove({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    setBusy(true);
    await createClient().from("family_festivals").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }
  return (
    <button onClick={remove} disabled={busy} aria-label={`Remove ${name}`} className="text-xs font-semibold underline px-3"
      style={{ minHeight: 44, color: "#B42318" }}>Remove</button>
  );
}
