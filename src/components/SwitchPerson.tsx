"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * An invitation belongs to the person it was sent to, not to whoever is
 * signed in on this phone or computer. Signing out here brings the same
 * invitation back up for the newcomer, who can then register or sign in
 * on their own.
 */
export default function SwitchPerson({ code, who }: { code: string; who?: string | null }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    await createClient().auth.signOut();
    // A full load, so nothing of the earlier sign-in is left on the page
    window.location.assign(`/join/${code}`);
  }
  return (
    <button onClick={go} disabled={busy}
      className="w-full text-center py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-60"
      style={{ background: "#fff", border: "1.5px solid #6B46B8", color: "#6B46B8" }}>
      {busy ? "Signing out…" : who ? `Sign out and continue as ${who}` : "Sign out and continue as the invited person"}
    </button>
  );
}
