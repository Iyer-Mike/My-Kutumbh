"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B } from "@/lib/brand";
import {
  CATEGORIES, KINDS, SHELF_LIFE, STARTER, UNITS,
  categoryLabel, daysLeft, isLow, kindOf,
  type Kind, type Status, type Unit,
} from "@/lib/pantry";

export type PantryItem = {
  id: string; name: string; kind: Kind; category: string;
  quantity: number | null; unit: Unit | null; low_when: number | null;
  status: Status; bought_on: string | null; use_within_days: number | null; note: string | null;
};

export type ShoppingItem = {
  id: string; name: string; quantity: number | null; unit: Unit | null;
  source: "manual" | "low" | "menu"; status: "open" | "bought";
  pantry_item_id: string | null; requested_by: string | null; created_at: string;
};

const STATUS_STYLE: Record<Status, { label: string; bg: string; fg: string }> = {
  ok:  { label: "OK",    bg: "#E3F0E2", fg: "#2F6B33" },
  low: { label: "Low",   bg: B.goldTint, fg: B.goldInk },
  out: { label: "Out",   bg: "#FBE2DC", fg: "#9A2C1B" },
};

const amount = (q: number | null, u: Unit | null) =>
  q == null ? "" : `${Number.isInteger(q) ? q : q.toFixed(2).replace(/0$/, "")} ${u ?? ""}`.trim();

export default function PantryView({
  kutumbhId, userId, isPrime, initialItems, initialShopping, memberNames, today,
}: {
  kutumbhId: string; userId: string; isPrime: boolean;
  initialItems: PantryItem[]; initialShopping: ShoppingItem[];
  memberNames: Record<string, string>; today: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [shopping, setShopping] = useState(initialShopping);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "grain", quantity: "", unit: "kg" as Unit, low_when: "" });
  const [buyName, setBuyName] = useState("");

  const open = shopping.filter((s) => s.status === "open");

  function fail(what: string, message: string) {
    alert(`Couldn't ${what}: ${message}`);
    setBusy(false);
  }

  // ── The shelf ───────────────────────────────────────────────
  async function addItem(seed?: typeof STARTER[number]) {
    const name = (seed?.name ?? draft.name).trim();
    if (!name || busy) return;
    setBusy(true);
    const category = seed?.category ?? draft.category;
    const kind = seed?.kind ?? kindOf(category);
    const quantity = seed ? seed.quantity ?? null : draft.quantity ? parseFloat(draft.quantity) : null;
    const row = {
      kutumbh_id: kutumbhId, name, kind, category,
      quantity: kind === "sundry" ? null : quantity,
      unit: kind === "sundry" ? null : (seed?.unit ?? draft.unit),
      low_when: kind === "staple" ? (seed?.low_when ?? (draft.low_when ? parseFloat(draft.low_when) : null)) : null,
      bought_on: kind === "fresh" ? today : null,
      use_within_days: kind === "fresh" ? SHELF_LIFE[category] ?? 5 : null,
      updated_by: userId,
    };
    const { data, error } = await supabase.from("pantry_items").insert(row)
      .select("id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note").single();
    if (error) return fail("add that", error.message);
    setItems((prev) => [...prev, data as PantryItem].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft({ name: "", category, quantity: "", unit: draft.unit, low_when: "" });
    setBusy(false);
  }

  async function fillStarter() {
    if (busy) return;
    setBusy(true);
    const rows = STARTER.map((s) => ({
      kutumbh_id: kutumbhId, name: s.name, kind: s.kind, category: s.category,
      quantity: s.quantity ?? null, unit: s.unit ?? null, low_when: s.low_when ?? null,
      bought_on: s.kind === "fresh" ? today : null,
      use_within_days: s.kind === "fresh" ? SHELF_LIFE[s.category] ?? 5 : null,
      updated_by: userId,
    }));
    const { data, error } = await supabase.from("pantry_items").insert(rows)
      .select("id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note");
    if (error) return fail("start the shelf", error.message);
    setItems((data ?? []) as PantryItem[]);
    setBusy(false);
  }

  async function patch(id: string, changes: Partial<PantryItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    const { error } = await supabase.from("pantry_items")
      .update({ ...changes, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) alert(`Couldn't save that: ${error.message}`);
  }

  async function removeItem(item: PantryItem) {
    if (!confirm(`Take ${item.name} off the shelf?`)) return;
    const { error } = await supabase.from("pantry_items").delete().eq("id", item.id);
    if (error) { alert(`Couldn't remove it: ${error.message}`); return; }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  // Any member may say something is running low; it lands on the list
  async function flagLow(item: PantryItem) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("flag_pantry_low", { p_item: item.id });
    if (error) return fail("flag that", error.message);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "low" } : i)));
    const { data } = await supabase.from("shopping_items")
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at")
      .eq("kutumbh_id", kutumbhId).order("created_at", { ascending: false }).limit(120);
    setShopping((data ?? []) as ShoppingItem[]);
    setBusy(false);
  }

  // ── The shopping list ───────────────────────────────────────
  async function addToList() {
    const name = buyName.trim();
    if (!name || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("shopping_items")
      .insert({ kutumbh_id: kutumbhId, name, source: "manual", requested_by: userId })
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at").single();
    if (error) return fail("add that to the list", error.message);
    setShopping((prev) => [data as ShoppingItem, ...prev]);
    setBuyName("");
    setBusy(false);
  }

  /** Bought: tick it off and, when it came from the shelf, refill that item. */
  async function markBought(s: ShoppingItem) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("shopping_items")
      .update({ status: "bought", bought_by: userId, bought_at: new Date().toISOString() }).eq("id", s.id);
    if (error) return fail("tick that off", error.message);
    setShopping((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: "bought" } : x)));

    const shelfItem = s.pantry_item_id ? items.find((i) => i.id === s.pantry_item_id) : undefined;
    if (shelfItem && isPrime) {
      await patch(shelfItem.id, {
        status: "ok",
        bought_on: shelfItem.kind === "fresh" ? today : shelfItem.bought_on,
      });
    }
    setBusy(false);
  }

  async function removeFromList(s: ShoppingItem) {
    const { error } = await supabase.from("shopping_items").delete().eq("id", s.id);
    if (error) { alert(`Couldn't remove it: ${error.message}`); return; }
    setShopping((prev) => prev.filter((x) => x.id !== s.id));
  }

  const listText = open.map((s) => `• ${s.name}${s.quantity ? ` — ${amount(s.quantity, s.unit)}` : ""}`).join("\n");

  async function copyList() {
    try {
      await navigator.clipboard.writeText(`Shopping list\n${listText}`);
      alert("List copied — paste it into WhatsApp or a note.");
    } catch {
      alert("Couldn't copy on this phone. Long-press the list to copy it by hand.");
    }
  }

  // ── Rows ────────────────────────────────────────────────────
  function StapleRow({ item }: { item: PantryItem }) {
    const low = isLow(item);
    const step = item.unit === "g" || item.unit === "ml" ? 100 : item.unit === "kg" || item.unit === "l" ? 0.5 : 1;
    return (
      <div className="flex items-center gap-2 py-2.5" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: B.ink }}>{item.name}</p>
          <p className="text-[11px]" style={{ color: low ? B.goldInk : B.muted2 }}>
            {categoryLabel(item.category)}
            {item.low_when != null && ` · buy more below ${amount(item.low_when, item.unit)}`}
          </p>
        </div>
        {isPrime ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => patch(item.id, { quantity: Math.max(0, (item.quantity ?? 0) - step) })}
              className="w-7 h-7 rounded-lg text-sm font-bold" style={{ background: B.tint, color: B.violet }}
              aria-label={`Less ${item.name}`}>−</button>
            <span className="text-sm tabular-nums min-w-[68px] text-center" style={{ color: B.ink }}>
              {amount(item.quantity, item.unit) || "—"}
            </span>
            <button onClick={() => patch(item.id, { quantity: (item.quantity ?? 0) + step, status: "ok" })}
              className="w-7 h-7 rounded-lg text-sm font-bold" style={{ background: B.tint, color: B.violet }}
              aria-label={`More ${item.name}`}>+</button>
            <button onClick={() => removeItem(item)} className="w-7 h-7 rounded-lg text-xs"
              style={{ background: "#FBE2DC", color: "#9A2C1B" }} aria-label={`Remove ${item.name}`}>✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm tabular-nums" style={{ color: B.ink }}>{amount(item.quantity, item.unit)}</span>
            <LowButton item={item} />
          </div>
        )}
      </div>
    );
  }

  function FreshRow({ item }: { item: PantryItem }) {
    const left = daysLeft(item.bought_on, item.use_within_days, today);
    const soon = left != null && left <= 1;
    return (
      <div className="flex items-center gap-2 py-2.5" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: B.ink }}>{item.name}</p>
          <p className="text-[11px]" style={{ color: soon ? "#9A2C1B" : B.muted2 }}>
            {amount(item.quantity, item.unit) || categoryLabel(item.category)}
            {left != null && (left < 0 ? " · past its days" : left === 0 ? " · use today" : ` · use within ${left} day${left === 1 ? "" : "s"}`)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPrime && (
            <button onClick={() => patch(item.id, { bought_on: today, status: "ok" })}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: B.tint, color: B.violet }}>
              Bought today
            </button>
          )}
          <LowButton item={item} />
          {isPrime && (
            <button onClick={() => removeItem(item)} className="w-7 h-7 rounded-lg text-xs"
              style={{ background: "#FBE2DC", color: "#9A2C1B" }} aria-label={`Remove ${item.name}`}>✕</button>
          )}
        </div>
      </div>
    );
  }

  function SundryChip({ item }: { item: PantryItem }) {
    const s = STATUS_STYLE[item.status];
    const next: Status = item.status === "ok" ? "low" : item.status === "low" ? "out" : "ok";
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
        style={{ background: s.bg, border: `1px solid ${B.cardEdge}` }}>
        <span className="text-xs font-medium" style={{ color: s.fg }}>{item.name}</span>
        {isPrime ? (
          <button onClick={() => patch(item.id, { status: next })}
            className="text-[10px] font-bold uppercase" style={{ color: s.fg }}
            aria-label={`${item.name} is ${s.label}, tap for ${STATUS_STYLE[next].label}`}>
            {s.label}
          </button>
        ) : (
          <button onClick={() => flagLow(item)} className="text-[10px] font-bold uppercase" style={{ color: s.fg }}>
            {item.status === "ok" ? "Flag low" : s.label}
          </button>
        )}
      </div>
    );
  }

  function LowButton({ item }: { item: PantryItem }) {
    if (item.status !== "ok") {
      const s = STATUS_STYLE[item.status];
      return (
        <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.fg }}>
          {s.label}
        </span>
      );
    }
    return (
      <button onClick={() => flagLow(item)} disabled={busy}
        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50"
        style={{ background: B.goldTint, color: B.goldInk }}>
        Running low
      </button>
    );
  }

  const byKind = (k: Kind) => items.filter((i) => i.kind === k);
  const card = { background: B.card, border: `1px solid ${B.cardEdge}` } as const;

  return (
    <div className="grid gap-4">
      {/* Shopping list */}
      <section className="rounded-2xl px-4 py-4 grid gap-3" style={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>
            Shopping list
          </h2>
          {open.length > 0 && (
            <button onClick={copyList} className="text-xs font-semibold" style={{ color: B.violetLink }}>
              Copy list
            </button>
          )}
        </div>

        {open.length === 0 ? (
          <p className="text-sm" style={{ color: B.muted }}>Nothing to buy. Flag anything running low and it lands here.</p>
        ) : (
          <div className="grid">
            {open.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
                <button onClick={() => markBought(s)} disabled={busy}
                  className="w-6 h-6 shrink-0 rounded-md" style={{ border: `2px solid ${B.violet}` }}
                  aria-label={`Bought ${s.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: B.ink }}>
                    {s.name}{s.quantity ? ` — ${amount(s.quantity, s.unit)}` : ""}
                  </p>
                  <p className="text-[11px]" style={{ color: B.muted2 }}>
                    {s.source === "low" ? "Running low" : s.source === "menu" ? "From the menu" : "Added"}
                    {s.requested_by && memberNames[s.requested_by] ? ` · ${memberNames[s.requested_by]}` : ""}
                  </p>
                </div>
                <button onClick={() => removeFromList(s)} className="w-7 h-7 rounded-lg text-xs shrink-0"
                  style={{ background: "#FBE2DC", color: "#9A2C1B" }} aria-label={`Remove ${s.name}`}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <label htmlFor="buy-name" className="sr-only">Add to the shopping list</label>
          <input id="buy-name" value={buyName} onChange={(e) => setBuyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addToList(); }}
            placeholder="Add something to buy…" maxLength={60}
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm"
            style={{ border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink, outline: "none" }} />
          <button onClick={addToList} disabled={busy || !buyName.trim()}
            className="px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: B.button }}>
            Add
          </button>
        </div>
      </section>

      {/* The shelf, one card per kind */}
      {items.length === 0 ? (
        <section className="rounded-2xl px-4 py-5 grid gap-3 text-center" style={card}>
          <p className="text-sm" style={{ color: B.muted }}>
            The shelf is empty. {isPrime ? "Start with the usual kitchen list, then change what doesn't fit." : "The Prime Member sets it up."}
          </p>
          {isPrime && (
            <button onClick={fillStarter} disabled={busy}
              className="mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: B.button }}>
              {busy ? "Setting up…" : "Start with 16 usual items"}
            </button>
          )}
        </section>
      ) : (
        KINDS.map((k) => {
          const rows = byKind(k.key);
          if (rows.length === 0 && !isPrime) return null;
          return (
            <section key={k.key} className="rounded-2xl px-4 py-4 grid gap-2" style={card}>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>{k.label}</h2>
                <p className="text-[11px]" style={{ color: B.muted2 }}>{k.hint}</p>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm py-1" style={{ color: B.muted }}>Nothing here yet.</p>
              ) : k.key === "sundry" ? (
                <div className="flex flex-wrap gap-2 pt-1">{rows.map((i) => <SundryChip key={i.id} item={i} />)}</div>
              ) : (
                <div className="grid">
                  {rows.map((i) => k.key === "staple"
                    ? <StapleRow key={i.id} item={i} />
                    : <FreshRow key={i.id} item={i} />)}
                </div>
              )}
            </section>
          );
        })
      )}

      {/* Add to the shelf — Prime Member only */}
      {isPrime && (
        <section className="rounded-2xl px-4 py-4 grid gap-3" style={card}>
          {!adding ? (
            <button onClick={() => setAdding(true)} className="text-sm font-semibold text-left" style={{ color: B.violetLink }}>
              ＋ Put something on the shelf
            </button>
          ) : (
            <>
              <div className="grid gap-2">
                <label htmlFor="p-name" className="text-xs font-medium" style={{ color: B.muted }}>What is it?</label>
                <input id="p-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Basmati rice, curry leaves, hing…" maxLength={60}
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{ border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink, outline: "none" }} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <label htmlFor="p-cat" className="text-xs font-medium" style={{ color: B.muted }}>Kind</label>
                  <select id="p-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={{ border: `1.5px solid ${B.cardEdge}`, background: "#fff", color: B.ink, outline: "none" }}>
                    {KINDS.map((k) => (
                      <optgroup key={k.key} label={k.label}>
                        {CATEGORIES.filter((c) => c.kind === k.key).map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {kindOf(draft.category) !== "sundry" && (
                  <div className="grid gap-1">
                    <label htmlFor="p-qty" className="text-xs font-medium" style={{ color: B.muted }}>How much</label>
                    <div className="flex gap-1.5">
                      <input id="p-qty" type="number" inputMode="decimal" min="0" step="0.25" value={draft.quantity}
                        onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                        className="w-full min-w-0 rounded-xl px-3 py-2 text-sm"
                        style={{ border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink, outline: "none" }} />
                      <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
                        aria-label="Unit" className="rounded-xl px-2 py-2 text-sm"
                        style={{ border: `1.5px solid ${B.cardEdge}`, background: "#fff", color: B.ink, outline: "none" }}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {kindOf(draft.category) === "staple" && (
                <div className="grid gap-1">
                  <label htmlFor="p-low" className="text-xs font-medium" style={{ color: B.muted }}>
                    Tell me to buy more below
                  </label>
                  <input id="p-low" type="number" inputMode="decimal" min="0" step="0.25" value={draft.low_when}
                    onChange={(e) => setDraft({ ...draft, low_when: e.target.value })}
                    placeholder={`e.g. 1 ${draft.unit}`}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={{ border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink, outline: "none" }} />
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => addItem()} disabled={busy || !draft.name.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: B.button }}>
                  {busy ? "Adding…" : "Put it on the shelf"}
                </button>
                <button onClick={() => setAdding(false)} className="px-4 text-sm font-semibold" style={{ color: B.muted }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
