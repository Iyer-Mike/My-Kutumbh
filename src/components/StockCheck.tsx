"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";
import { friendly, unitChoices, naturalUnit, toShelf, looksTooMuch } from "@/lib/units";
import { LIBRARY_BY_KEY, convert, matchLibrary, type Estimate } from "@/lib/kitchen-library";
import type { Unit } from "@/lib/pantry";

// The monthly stock check: count what is really on the shelf, so the app's guesses start fresh.
//  * Staples (rice, dals, flours, oil, sugar): counted every month
//  * Fresh things: not counted, except where the app thinks the figure cannot be right
//  * Spices and sundries: only OK / low / out, once a quarter

export type CheckItem = {
  id: string; name: string; kind: "staple" | "fresh" | "sundry"; category: string;
  quantity: number | null; unit: Unit | null; library_key: string | null;
  supply_every?: number | null;
};

export const STAPLE_DAYS = 30;
export const SPICE_DAYS = 90;
const SPICE_KEY = "mk-spice-check";

const daysSince = (d: string, today: string) =>
  Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${d}T00:00:00Z`).getTime()) / 86400000);

export default function StockCheck({ items, est, today, kutumbhId, onClose }: {
  items: CheckItem[]; est: Record<string, Estimate | undefined>; today: string; kutumbhId: string;
  onClose: (changed: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [last, setLast] = useState<Record<string, string> | null>(null);
  const [counted, setCounted] = useState<Record<string, { qty: number; guess: number | null }>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [spice, setSpice] = useState<Record<string, "ok" | "low" | "out">>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("pantry_stock_events").select("pantry_item_id, on_date")
      .eq("kutumbh_id", kutumbhId).eq("kind", "count").order("created_at", { ascending: false }).limit(3000)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        for (const r of data ?? []) if (!m[r.pantry_item_id as string]) m[r.pantry_item_id as string] = r.on_date as string;
        setLast(m);
      });
  }, [supabase, kutumbhId]);

  const staples = useMemo(() => {
    if (!last) return [];
    return items
      .filter((i) => i.kind === "staple" && i.unit && !i.supply_every)
      .filter((i) => !last[i.id] || daysSince(last[i.id], today) > STAPLE_DAYS || counted[i.id])
      .sort((a, b) => (last[a.id] ? daysSince(last[a.id], today) : 9999) < (last[b.id] ? daysSince(last[b.id], today) : 9999) ? 1 : -1);
  }, [items, last, today, counted]);

  const doubtful = useMemo(() => items.filter((i) => i.kind === "fresh" && !i.supply_every && est[i.id]?.suspect), [items, est]);

  const spiceDue = useMemo(() => {
    try { const d = localStorage.getItem(`${SPICE_KEY}-${kutumbhId}`); if (d && daysSince(d, today) <= SPICE_DAYS) return false; } catch { /* ask */ }
    return true;
  }, [kutumbhId, today]);
  const spices = items.filter((i) => i.kind === "sundry");

  const entryUnit = (i: CheckItem): Unit | null => {
    const lib = i.library_key ? LIBRARY_BY_KEY.get(i.library_key) : matchLibrary(i.name) ?? undefined;
    return naturalUnit(i.unit, lib ? convert(lib.pack, lib.unit, i.unit ?? lib.unit) : null);
  };

  async function count(i: CheckItem, qty: number) {
    if (!i.unit) return;
    if (looksTooMuch(qty, i.unit) && !confirm(`${friendly(qty, i.unit)} of ${i.name} is a lot. Is that right?`)) return;
    setBusy(i.id);
    const { error } = await supabase.rpc("count_stock", { p_item: i.id, p_qty: qty, p_on: today });
    setBusy(null);
    if (error) { alert(`Couldn't save that: ${error.message}`); return; }
    setCounted((c) => ({ ...c, [i.id]: { qty, guess: est[i.id]?.est ?? i.quantity } }));
  }

  async function countTyped(i: CheckItem) {
    const text = typed[i.id] ?? "";
    const n = parseFloat(text);
    if (!Number.isFinite(n) || n < 0) { alert("Please type a number, such as 250."); return; }
    const u = units[i.id] ?? entryUnit(i) ?? i.unit;
    const q = toShelf(n, u, i.unit);
    if (q == null) return;
    await count(i, q);
  }

  async function setSpiceState(i: CheckItem, s: "ok" | "low" | "out") {
    setBusy(i.id);
    if (s === "ok") {
      await supabase.from("pantry_items").update({ status: "ok", updated_at: new Date().toISOString() }).eq("id", i.id);
    } else {
      await supabase.rpc("flag_pantry_low", { p_item: i.id });
      if (s === "out") await supabase.from("pantry_items").update({ status: "out" }).eq("id", i.id);
    }
    setBusy(null);
    setSpice((m) => ({ ...m, [i.id]: s }));
  }

  function finish() {
    if (Object.keys(spice).length) {
      try { localStorage.setItem(`${SPICE_KEY}-${kutumbhId}`, today); } catch { /* ignore */ }
    }
    onClose(Object.keys(counted).length > 0 || Object.keys(spice).length > 0);
  }

  const countedN = Object.keys(counted).length;
  const toCount = staples.filter((i) => !skipped.has(i.id) || counted[i.id]);
  const off = Object.entries(counted)
    .map(([id, c]) => ({ it: items.find((x) => x.id === id)!, ...c }))
    .filter((x) => x.guess != null && x.guess > 0 && Math.abs(x.qty - (x.guess as number)) / Math.max(x.guess as number, x.qty) >= 0.15)
    .sort((a, b) => Math.abs(b.qty - (b.guess as number)) - Math.abs(a.qty - (a.guess as number)))
    .slice(0, 5);

  const row = (i: CheckItem, flag?: string) => {
    const done = counted[i.id];
    const guess = est[i.id]?.est ?? i.quantity;
    const choices = unitChoices(i.unit);
    return (
      <div key={i.id} className="py-2.5 grid gap-2" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium m-0 truncate" style={{ color: B.ink }}>{done ? "✓ " : ""}{i.name}</p>
          <p className="text-xs m-0 shrink-0" style={{ color: flag ? "#9A2C1B" : B.muted2 }}>
            {done ? `counted ${friendly(done.qty, i.unit)}`
              : flag ?? (guess != null ? `app thinks about ${friendly(guess, i.unit)}` : "not counted yet")}
          </p>
        </div>
        {!done && (
          <div className="flex flex-wrap items-center gap-1.5">
            {guess != null && guess > 0 && (
              <button onClick={() => count(i, guess)} disabled={busy === i.id}
                className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ background: B.tint, color: B.violet }}>
                About right
              </button>
            )}
            <input type="number" inputMode="decimal" min="0" step="any" value={typed[i.id] ?? ""}
              onChange={(e) => setTyped((t) => ({ ...t, [i.id]: e.target.value }))} placeholder="How much"
              aria-label={`How much ${i.name} is there`}
              className="w-24 min-w-0 rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.blue)} />
            {choices.length > 1 ? (
              <select value={units[i.id] ?? entryUnit(i) ?? choices[0]} onChange={(e) => setUnits((u) => ({ ...u, [i.id]: e.target.value as Unit }))}
                aria-label={`Unit for ${i.name}`} className="rounded-xl px-2 py-2 text-sm" style={fieldLook(FAMILY.blue)}>
                {choices.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : <span className="text-sm" style={{ color: B.muted }}>{choices[0] ?? ""}</span>}
            <button onClick={() => countTyped(i)} disabled={busy === i.id || !(typed[i.id] ?? "").trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: B.button }}>Save</button>
            <button onClick={() => count(i, 0)} disabled={busy === i.id}
              className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ background: "#FBE2DC", color: "#9A2C1B" }}>None</button>
            <button onClick={() => setSkipped((s) => new Set(s).add(i.id))}
              className="px-2 py-2 text-xs" style={{ color: B.muted }}>Skip</button>
          </div>
        )}
      </div>
    );
  };

  if (last === null) return <p className="text-sm text-center py-6" style={{ color: B.muted }}>Opening the stock check…</p>;

  const nothing = toCount.length === 0 && doubtful.length === 0 && (!spiceDue || spices.length === 0);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={finish} className="text-xs font-semibold" style={{ color: B.violetLink }}>← Back to the shelf</button>
        <p className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: FAMILY.blue.ink }}>Stock check</p>
      </div>

      <section className="rounded-2xl px-4 py-4 grid gap-1" style={look(FAMILY.blue)}>
        <p className="text-sm m-0" style={{ color: B.ink }}>
          Look at each item, then tap <b>About right</b>, type the amount, or tap <b>None</b>. Only what you count is changed.
        </p>
        <p className="text-xs m-0" style={{ color: B.muted }}>
          Staples are counted every month, spices every quarter, and fresh things only when a figure looks wrong.
          {countedN > 0 ? ` · ${countedN} counted so far` : ""}
        </p>
      </section>

      {nothing && (
        <section className="rounded-2xl px-4 py-5 text-center" style={look(FAMILY.green)}>
          <p className="text-sm m-0" style={{ color: B.ink }}>Everything is counted. The next check is due in about a month.</p>
        </section>
      )}

      {toCount.length > 0 && (
        <section className="rounded-2xl px-4 py-3" style={look(FAMILY.blue)}>
          <h2 className="text-sm font-bold uppercase tracking-wider m-0 pb-1" style={{ color: FAMILY.blue.ink }}>
            Staples · {toCount.filter((i) => !counted[i.id]).length} to count
          </h2>
          {toCount.map((i) => row(i, !counted[i.id] && last[i.id] ? `last counted ${daysSince(last[i.id], today)} days ago` : undefined))}
        </section>
      )}

      {doubtful.length > 0 && (
        <section className="rounded-2xl px-4 py-3" style={look(FAMILY.green)}>
          <h2 className="text-sm font-bold uppercase tracking-wider m-0 pb-1" style={{ color: FAMILY.green.ink }}>Fresh · figures that look too high</h2>
          {doubtful.map((i) => row(i, `app has ${friendly(est[i.id]?.est ?? i.quantity, i.unit)}: please recount`))}
        </section>
      )}

      {spiceDue && spices.length > 0 && (
        <section className="rounded-2xl px-4 py-3" style={look(FAMILY.amber)}>
          <h2 className="text-sm font-bold uppercase tracking-wider m-0 pb-1" style={{ color: FAMILY.amber.ink }}>Spices · quarterly look</h2>
          {spices.map((i) => (
            <div key={i.id} className="py-2 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
              <p className="text-sm m-0 truncate" style={{ color: B.ink }}>{i.name}</p>
              <div className="flex gap-1.5 shrink-0">
                {(["ok", "low", "out"] as const).map((s) => (
                  <button key={s} onClick={() => setSpiceState(i, s)} disabled={busy === i.id}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={spice[i.id] === s
                      ? { background: s === "ok" ? "#2F6B33" : "#9A2C1B", color: "#fff" }
                      : { background: s === "ok" ? "#E3F0E2" : "#FBE2DC", color: s === "ok" ? "#2F6B33" : "#9A2C1B" }}>
                    {s === "ok" ? "OK" : s === "low" ? "Low" : "Out"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {countedN > 0 && (
        <section className="rounded-2xl px-4 py-4 grid gap-1" style={look(FAMILY.violet)}>
          <p className="text-sm font-semibold m-0" style={{ color: B.ink }}>
            {countedN} counted{off.length ? `, ${off.length} differ${off.length === 1 ? "s" : ""} from the app's guess` : ", all close to the app's guess"}
          </p>
          {off.map((x) => (
            <p key={x.it.id} className="text-xs m-0" style={{ color: B.muted }}>
              {x.it.name}: app guessed {friendly(x.guess, x.it.unit)}, you counted {friendly(x.qty, x.it.unit)}
            </p>
          ))}
        </section>
      )}

      <button onClick={finish} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: B.button }}>
        {countedN > 0 || Object.keys(spice).length ? "Done" : "Close"}
      </button>
    </div>
  );
}
