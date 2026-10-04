"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FestivalAdder({ kutumbhId, userId }: { kutumbhId: string; userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim() || !date || busy) return;
    setBusy(true); setError(null);
    const { error: err } = await createClient().from("family_festivals")
      .insert({ kutumbh_id: kutumbhId, name: name.trim(), festival_date: date, created_by: userId });
    setBusy(false);
    if (err) { setError("Could not add this. Please try again."); return; }
    setName(""); setDate("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl p-4 grid gap-2" style={{ background: "#fff", border: "1px solid #E0D4F2" }}>
      <p className="m-0 text-sm font-semibold" style={{ color: "#241C33" }}>Add a festival or family occasion</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Karthigai Deepam" maxLength={80}
        aria-label="Festival name" className="w-full text-sm rounded-xl px-3" style={{ minHeight: 44, border: "1px solid #E0D4F2" }} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Festival date"
        className="w-full text-sm rounded-xl px-3" style={{ minHeight: 44, border: "1px solid #E0D4F2" }} />
      <button onClick={add} disabled={!name.trim() || !date || busy}
        className="rounded-full text-sm font-semibold text-white disabled:opacity-40" style={{ minHeight: 44, background: "#241238" }}>
        {busy ? "Adding…" : "Add to the list"}
      </button>
      {error && <p className="m-0 text-xs" style={{ color: "#B42318" }}>{error}</p>}
    </div>
  );
}
