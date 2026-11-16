"use client";

import { useState, useTransition } from "react";
import { setFamilyLimit } from "@/app/(app)/admin/door-actions";

/**
 * The Admin's two levers on one family: its monthly AI allowance, and a pause.
 * A paused family cannot open the app or spend on AI until it is resumed.
 */
export default function FamilyLimitControls({ kutumbhId, name, allowance, custom, blocked }: {
  kutumbhId: string; name: string; allowance: number; custom: boolean; blocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(allowance));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (rupees: number | null, block: boolean) =>
    start(async () => {
      setError(null);
      const r = await setFamilyLimit(kutumbhId, rupees, block);
      if (!r.ok) setError(r.error ?? "It didn't work."); else setOpen(false);
    });
  const pill = "text-xs font-semibold px-3 py-2 rounded-full disabled:opacity-50";

  return (
    <div className="mt-2">
      {blocked && (
        <p className="m-0 mb-2 text-xs font-semibold rounded-lg px-3 py-2" style={{ background: "#FBEBEB", border: "1.5px solid #B0453A", color: "#8A1C12" }}>
          Paused by you. This family cannot open the app or use AI.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen(!open)} className={pill} style={{ background: "#E7DCF7", color: "#6B46B8" }}>
          {open ? "Close" : "Change AI allowance"}
        </button>
        <button disabled={pending} className={pill}
          style={blocked ? { background: "#2F6B34", color: "#fff" } : { border: "1.5px solid #B0453A", color: "#B0453A" }}
          onClick={() => {
            if (!blocked && !confirm(`Pause ${name}?\n\nNobody in this family will be able to open the app or use AI until you resume it. Their data is kept.`)) return;
            run(custom ? allowance : null, !blocked);
          }}>
          {blocked ? "Resume this family" : "Pause this family"}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs" style={{ color: "#4A4360" }}>₹ a month
            <input type="number" inputMode="numeric" min="0" max="5000" step="50" value={value} onChange={(e) => setValue(e.target.value)}
              className="ml-2 w-24 rounded-lg px-2 py-1.5 text-sm" style={{ border: "1.5px solid #CBB4EE", background: "#fff" }} />
          </label>
          <button disabled={pending} className={pill} style={{ background: "#241238", color: "#fff" }}
            onClick={() => {
              const n = Number(value);
              if (!Number.isFinite(n) || n < 0 || n > 5000) { setError("Type an amount between 0 and 5,000."); return; }
              run(Math.round(n), blocked);
            }}>
            {pending ? "Saving…" : "Save"}
          </button>
          {custom && (
            <button disabled={pending} className={pill} style={{ color: "#6A6180" }} onClick={() => run(null, blocked)}>
              Back to the usual rule
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="m-0 mt-2 text-xs" style={{ color: "#B0453A" }}>{error}</p>}
    </div>
  );
}
