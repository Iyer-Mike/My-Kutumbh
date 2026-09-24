"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";
import { TIME_ZONES, deviceTimeZone, longDateLocal, timeZoneLabel } from "@/lib/dates";

/** The Prime Member sets where the family's day starts and ends. */
export default function FamilyTimeZoneCard({ kutumbhId, timeZone }: { kutumbhId: string; timeZone: string }) {
  const supabase = createClient();
  const [tz, setTz] = useState(timeZone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const device = deviceTimeZone();
  const mismatch = device && device !== tz;

  async function choose(next: string) {
    if (next === tz || saving) return;
    setSaving(true);
    const { error } = await supabase.from("kutumbhs").update({ time_zone: next }).eq("id", kutumbhId);
    setSaving(false);
    if (error) { alert(`Couldn't change the time zone: ${error.message}`); return; }
    setTz(next);
    setSaved(true);
    // The whole app counts days from this, so reload rather than half-update
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: B.card, border: `1px solid ${B.cardEdge}` }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full text-left">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: B.muted2 }}>
          The family&apos;s day
        </p>
        <p className="text-xs mt-1" style={{ color: B.muted }}>
          {timeZoneLabel(tz)} · today is {longDateLocal(tz)}
        </p>
      </button>

      {mismatch && !open && (
        <p className="text-[11px] mt-2 rounded-lg px-2.5 py-1.5" style={{ background: B.goldTint, color: B.goldInk }}>
          This phone is set to {timeZoneLabel(device)}. Tap to change the family&apos;s day if you&apos;ve moved.
        </p>
      )}

      {open && (
        <div className="mt-3 grid gap-2">
          <p className="text-xs" style={{ color: B.muted }}>
            Meals, menus and insights are counted from midnight to midnight here. Days already logged keep their date.
          </p>
          <label htmlFor="tz" className="sr-only">Time zone</label>
          <select id="tz" value={tz} onChange={(e) => choose(e.target.value)} disabled={saving}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ border: `1.5px solid ${B.cardEdge}`, background: "#fff", color: B.ink, outline: "none" }}>
            {TIME_ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
          {device && device !== tz && (
            <button onClick={() => choose(device)} disabled={saving}
              className="text-xs font-semibold text-left" style={{ color: B.violetLink }}>
              Use this phone&apos;s time zone ({timeZoneLabel(device)})
            </button>
          )}
          {saved && <p className="text-xs" style={{ color: "#2F7A35" }}>Saved — reloading…</p>}
        </div>
      )}
    </div>
  );
}
