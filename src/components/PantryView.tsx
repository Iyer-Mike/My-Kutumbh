"use client";

import { useRef, useState } from "react";
import { haveIt, sameThing } from "@/lib/ingredients";
import { createClient } from "@/lib/supabase/client";
import { BRAND as B, FAMILY, look, fieldLook } from "@/lib/brand";
import { readBase64, toJpegPayload } from "@/lib/photo";
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
  bought_at: string | null;
};

const STATUS_STYLE: Record<Status, { label: string; bg: string; fg: string }> = {
  ok:  { label: "OK",    bg: "#E3F0E2", fg: "#2F6B33" },
  low: { label: "Low",   bg: B.goldTint, fg: B.goldInk },
  out: { label: "Out",   bg: "#FBE2DC", fg: "#9A2C1B" },
};

// Each kind of stock has its own coloured edge
const KIND_LOOK: Record<Kind, { bg: string; edge: string; ink: string }> = {
  staple: { bg: "#E8F2FD", edge: "#2E64A0", ink: "#1D4A7C" },   // blue
  fresh:  { bg: "#E6F6EA", edge: "#2E8B57", ink: "#1F6B40" },   // green
  sundry: { bg: "#FFE9C7", edge: "#C2551F", ink: "#9A3F10" },   // amber
};

const amount = (q: number | null, u: Unit | null) =>
  q == null ? "" : `${Number.isInteger(q) ? q : q.toFixed(2).replace(/0$/, "")} ${u ?? ""}`.trim();

/** A line read off a bill, waiting to be checked before it touches the shelf. */
type BillLine = {
  name: string; quantity: number | null; unit: Unit | null; category: string;
  take: boolean; matchId: string | null;
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Same thing by another name? "Milk" and "Amul milk" are; "Toor dal" and "Moong dal" are not. */
function findMatch(name: string, items: PantryItem[]): PantryItem | null {
  const a = norm(name);
  if (!a) return null;
  const exact = items.find((i) => norm(i.name) === a);
  if (exact) return exact;
  return items.find((i) => {
    const b = norm(i.name);
    return b.length >= 4 && a.length >= 4 && (a.includes(b) || b.includes(a));
  }) ?? null;
}

/** kg ↔ g and l ↔ ml convert; anything else keeps the shelf's own unit. */
function inShelfUnit(qty: number, from: Unit | null, to: Unit | null): number | null {
  if (qty == null || !from || !to) return null;
  if (from === to) return qty;
  const f: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000 };
  const massOrVolume = (u: Unit) => (u === "g" || u === "kg" ? "m" : u === "ml" || u === "l" ? "v" : null);
  if (massOrVolume(from) && massOrVolume(from) === massOrVolume(to)) {
    return Math.round(((qty * f[from]) / f[to]) * 100) / 100;
  }
  return null;
}

export default function PantryView({
  kutumbhId, userId, isPrime, initialItems, initialShopping, menuDays, memberNames, today,
}: {
  kutumbhId: string; userId: string; isPrime: boolean;
  initialItems: PantryItem[]; initialShopping: ShoppingItem[];
  menuDays: { date: string; label: string; dishes: { name: string; ings: string[] }[] }[];
  memberNames: Record<string, string>; today: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [shopping, setShopping] = useState(initialShopping);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "grain", quantity: "", unit: "kg" as Unit, low_when: "" });
  const [buyName, setBuyName] = useState("");
  const [step, setStep] = useState<null | "shelf" | "menu" | "shop">(null);
  const [tab, setTab] = useState<"staple" | "spice" | "fruit" | "fresh">("staple");

  // Reading a shop bill
  const billRef = useRef<HTMLInputElement>(null);
  const billCamRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [billNote, setBillNote] = useState<string | null>(null);
  const [bill, setBill] = useState<{ shop: string | null; lines: BillLine[] } | null>(null);

  const open = shopping.filter((s) => s.status === "open");
  // Ticked off in the last two days stays in view, so you can see it took
  const recentCut = Date.now() - 2 * 24 * 3600 * 1000;
  const bought = shopping.filter((s) => s.status === "bought" && (!s.bought_at || new Date(s.bought_at).getTime() >= recentCut));

  // What the next seven days' dishes need that is neither on the shelf nor already on the list
  const shelfNames = items.map((i) => i.name);
  const listedNames = open.map((s) => s.name);
  const ingState = (n: string): "have" | "listed" | "short" =>
    haveIt(n, shelfNames) ? "have" : haveIt(n, listedNames) ? "listed" : "short";
  const needed = (() => {
    const m = new Map<string, { name: string }>();
    for (const d of menuDays) for (const dish of d.dishes) for (const ing of dish.ings) {
      const k = sameThing(ing);
      if (k && !m.has(k) && ingState(ing) === "short") m.set(k, { name: ing.charAt(0).toUpperCase() + ing.slice(1) });
    }
    return [...m.values()];
  })();

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
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at")
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
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at").single();
    if (error) return fail("add that to the list", error.message);
    setShopping((prev) => [data as ShoppingItem, ...prev]);
    setBuyName("");
    setBusy(false);
  }

  /** An ingredient the menu needs but the kitchen hasn't got. */
  async function addFromMenu(name: string) {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("shopping_items")
      .insert({ kutumbh_id: kutumbhId, name, source: "menu", requested_by: userId })
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at").single();
    if (error) return fail("add that to the list", error.message);
    setShopping((prev) => [data as ShoppingItem, ...prev]);
    setBusy(false);
  }

  async function addAllFromMenu() {
    const rest = needed;
    if (!rest.length || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("shopping_items")
      .insert(rest.map((m) => ({ kutumbh_id: kutumbhId, name: m.name, source: "menu", requested_by: userId })))
      .select("id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at");
    if (error) return fail("add those to the list", error.message);
    setShopping((prev) => [...((data ?? []) as ShoppingItem[]), ...prev]);
    setBusy(false);
  }

  /** Bought: tick it off and, when it came from the shelf, refill that item. */
  async function markBought(s: ShoppingItem) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("shopping_items")
      .update({ status: "bought", bought_by: userId, bought_at: new Date().toISOString() }).eq("id", s.id);
    if (error) return fail("tick that off", error.message);
    setShopping((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: "bought", bought_at: new Date().toISOString() } : x)));

    const shelfItem = s.pantry_item_id ? items.find((i) => i.id === s.pantry_item_id) : undefined;
    if (shelfItem && isPrime) {
      await patch(shelfItem.id, {
        status: "ok",
        bought_on: shelfItem.kind === "fresh" ? today : shelfItem.bought_on,
      });
    }
    setBusy(false);
  }

  /** Ticked by mistake: back onto the list. */
  async function unbuy(s: ShoppingItem) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("shopping_items")
      .update({ status: "open", bought_by: null, bought_at: null }).eq("id", s.id);
    if (error) return fail("put that back", error.message);
    setShopping((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: "open", bought_at: null } : x)));
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
      alert("Copied · Paste into WhatsApp or a note.");
    } catch {
      alert("Copy failed · Long-press the list to copy.");
    }
  }

  // ── A shop bill, read by photo ──────────────────────────────
  async function handleBillPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;                       // they backed out of the chooser

    // A bill is often a PDF from the shop's app. It goes as it is — putting
    // it through the photo squeezer only broke it.
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf && file.size > 3_500_000) {
      setBillNote("PDF too large · Photograph the bill or use a smaller file.");
      return;
    }

    setReading(true);
    setBillNote(null);
    setBill(null);
    try {
      const { base64, mediaType } = isPdf
        ? { base64: await readBase64(file), mediaType: "application/pdf" }
        : await toJpegPayload(file);
      abortRef.current = new AbortController();
      const res = await fetch("/api/read-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
        signal: abortRef.current.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setBillNote(data.error ?? "Couldn't read that bill."); return; }

      const lines: BillLine[] = (data.items ?? []).map((i: Omit<BillLine, "take" | "matchId">) => {
        const match = findMatch(i.name, items);
        return { ...i, take: true, matchId: match?.id ?? null };
      });
      if (lines.length === 0) {
        setBillNote("No kitchen items found · Retake it straighter and brighter.");
        return;
      }
      setBill({ shop: data.shop ?? null, lines });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setBillNote(null);
      else setBillNote(err instanceof Error ? err.message : "Couldn't read that bill.");
    } finally {
      abortRef.current = null;
      setReading(false);
    }
  }

  function stopReading() {
    abortRef.current?.abort();
    setReading(false);
    setBillNote(null);
  }

  /** Put the ticked lines on the shelf: top up what's there, add what isn't. */
  async function applyBill() {
    if (!bill || busy) return;
    const take = bill.lines.filter((l) => l.take);
    if (take.length === 0) { setBill(null); return; }
    setBusy(true);

    const updates: PantryItem[] = [];
    const inserts: Record<string, unknown>[] = [];

    for (const line of take) {
      const shelf = line.matchId ? items.find((i) => i.id === line.matchId) : undefined;
      if (shelf) {
        const added = line.quantity != null ? inShelfUnit(line.quantity, line.unit, shelf.unit) : null;
        updates.push({
          ...shelf,
          status: "ok",
          quantity: shelf.kind === "sundry" ? shelf.quantity
            : added != null ? Math.round(((shelf.quantity ?? 0) + added) * 100) / 100
            : shelf.quantity,
          bought_on: shelf.kind === "fresh" ? today : shelf.bought_on,
        });
      } else {
        const kind = kindOf(line.category);
        inserts.push({
          kutumbh_id: kutumbhId, name: line.name, kind, category: line.category,
          quantity: kind === "sundry" ? null : line.quantity,
          unit: kind === "sundry" ? null : line.unit,
          bought_on: kind === "fresh" ? today : null,
          use_within_days: kind === "fresh" ? SHELF_LIFE[line.category] ?? 5 : null,
          updated_by: userId,
        });
      }
    }

    for (const u of updates) {
      const { error } = await supabase.from("pantry_items")
        .update({ quantity: u.quantity, status: u.status, bought_on: u.bought_on, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", u.id);
      if (error) return fail("update the shelf", error.message);
    }

    let added: PantryItem[] = [];
    if (inserts.length) {
      const { data, error } = await supabase.from("pantry_items").insert(inserts)
        .select("id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note");
      if (error) return fail("add those items", error.message);
      added = (data ?? []) as PantryItem[];
    }

    setItems((prev) => {
      const byId = new Map(updates.map((u) => [u.id, u]));
      return [...prev.map((i) => byId.get(i.id) ?? i), ...added].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Anything on the shopping list that was just bought comes off it
    const boughtNames = new Set(take.map((l) => norm(l.name)));
    const done = open.filter((s) => boughtNames.has(norm(s.name)) || (s.pantry_item_id && take.some((l) => l.matchId === s.pantry_item_id)));
    if (done.length) {
      await supabase.from("shopping_items")
        .update({ status: "bought", bought_by: userId, bought_at: new Date().toISOString() })
        .in("id", done.map((s) => s.id));
      setShopping((prev) => prev.map((s) => (done.some((d) => d.id === s.id) ? { ...s, status: "bought" } : s)));
    }

    setBill(null);
    setBillNote(`${take.length} item${take.length > 1 ? "s" : ""} put on the shelf${done.length ? `, ${done.length} ticked off the list` : ""}.`);
    setBusy(false);
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


  // ── The steps ───────────────────────────────────────────────
  const TABS = [
    { key: "staple", label: "Staples",        hint: "Rice, dals, atta, oil, sugar — kept by weight",   tone: KIND_LOOK.staple, match: (i: PantryItem) => i.kind === "staple" },
    { key: "spice",  label: "Spices",         hint: "Nobody weighs haldi — just OK, low or out",       tone: KIND_LOOK.sundry, match: (i: PantryItem) => i.kind === "sundry" },
    { key: "fruit",  label: "Fruits",         hint: "Bought often, used soon",                         tone: { bg: FAMILY.violet.bg, edge: FAMILY.violet.edge, ink: FAMILY.violet.ink }, match: (i: PantryItem) => i.kind === "fresh" && i.category === "fruit" },
    { key: "fresh",  label: "Greens & Fresh", hint: "Vegetables, greens, milk and curd — used soon",   tone: KIND_LOOK.fresh,  match: (i: PantryItem) => i.kind === "fresh" && i.category !== "fruit" },
  ] as const;
  const lowCount = items.filter((i) => isLow(i) || i.status !== "ok").length;
  const plannedDays = menuDays.filter((d) => d.dishes.length > 0).length;

  const STEPS = [
    { key: "shelf", n: 1, title: "Shelf", ask: "What do we have?",
      line: items.length === 0 ? "Not started yet" : `${items.length} item${items.length === 1 ? "" : "s"}${lowCount ? ` · ${lowCount} low` : " · none low"}`,
      tone: FAMILY.blue },
    { key: "menu", n: 2, title: "Menu", ask: "What will we cook?",
      line: plannedDays === 0 ? "Nothing planned this week" : `${plannedDays} day${plannedDays === 1 ? "" : "s"} planned · ${needed.length ? `${needed.length} short` : "nothing short"}`,
      tone: FAMILY.amber },
    { key: "shop", n: 3, title: "Shop", ask: "What do we buy?",
      line: open.length ? `${open.length} to buy` : "Nothing to buy",
      tone: FAMILY.green },
  ] as const;

  const Arrow = ({ dir, tone }: { dir: "left" | "right"; tone: { edge: string } }) => (
    <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xl font-bold leading-none"
      style={{ background: "#fff", border: `2px solid ${tone.edge}`, color: tone.edge }} aria-hidden="true">
      {dir === "right" ? "›" : "‹"}
    </span>
  );

  // Step 1 · the shelf, four tabs
  const current = TABS.find((t) => t.key === tab)!;
  const tabRows = items.filter(current.match);
  const shelfStep = (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <section className="rounded-2xl px-4 py-5 grid gap-3 text-center" style={look(FAMILY.violet)}>
          <p className="text-sm" style={{ color: B.muted }}>
            Shelf empty · {isPrime ? "Start with the usual list, then edit." : "The Key Member sets it up."}
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
        <>
          <div role="tablist" className="grid grid-cols-4 gap-1.5">
            {TABS.map((t) => {
              const n = items.filter(t.match).length;
              const low = items.filter((i) => t.match(i) && (isLow(i) || i.status !== "ok")).length;
              const on = t.key === tab;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                  className="rounded-xl px-1 py-2 text-center leading-tight"
                  style={{ background: on ? t.tone.edge : t.tone.bg, border: `2px solid ${t.tone.edge}`, color: on ? "#fff" : t.tone.ink }}>
                  <span className="block text-xs font-bold">{t.label}</span>
                  <span className="block text-[10px] opacity-90">{n}{low ? ` · ${low} low` : ""}</span>
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl px-4 py-4 grid gap-2"
            style={{ background: current.tone.bg, border: `2.5px solid ${current.tone.edge}` }}>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: current.tone.ink }}>{current.label}</h2>
              <p className="text-[11px]" style={{ color: B.muted2 }}>{current.hint}</p>
            </div>
            {tabRows.length === 0 ? (
              <p className="text-sm py-1" style={{ color: B.muted }}>Nothing here yet.</p>
            ) : current.key === "spice" ? (
              <div className="flex flex-wrap gap-2 pt-1">{tabRows.map((i) => <SundryChip key={i.id} item={i} />)}</div>
            ) : (
              <div className="grid">
                {tabRows.map((i) => current.key === "staple"
                  ? <StapleRow key={i.id} item={i} />
                  : <FreshRow key={i.id} item={i} />)}
              </div>
            )}
          </section>
        </>
      )}

      {isPrime && (
        <section className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.amber)}>
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
                  style={fieldLook(FAMILY.amber)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <label htmlFor="p-cat" className="text-xs font-medium" style={{ color: B.muted }}>Kind</label>
                  <select id="p-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={fieldLook(FAMILY.amber)}>
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
                        style={fieldLook(FAMILY.amber)} />
                      <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
                        aria-label="Unit" className="rounded-xl px-2 py-2 text-sm"
                        style={fieldLook(FAMILY.amber)}>
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
                    style={fieldLook(FAMILY.amber)} />
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

  // Step 2 · the week's menu against the shelf
  const chip = (state: "have" | "listed" | "short") =>
    state === "have" ? FAMILY.green : state === "listed" ? FAMILY.gold : FAMILY.red;
  const menuStep = (
    <div className="grid gap-4">
      <section className="rounded-2xl px-4 py-4 grid gap-2" style={look(needed.length ? FAMILY.red : FAMILY.green)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>
              {needed.length ? `${needed.length} short for the week` : "Nothing short"}
            </h2>
            <p className="text-[11px]" style={{ color: B.muted2 }}>
              Next 7 days · <span style={{ color: FAMILY.green.ink }}>on the shelf</span> · <span style={{ color: FAMILY.gold.ink }}>already on the list</span> · <span style={{ color: FAMILY.red.ink }}>short</span>
            </p>
          </div>
          {needed.length > 0 && (
            <button onClick={addAllFromMenu} disabled={busy}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: B.button }}>
              Add all to list
            </button>
          )}
        </div>
        <p className="text-[11px]" style={{ color: B.muted2 }}>
          Amounts are left to you — a family pot is never one recipe.
        </p>
      </section>

      {menuDays.length === 0 ? (
        <section className="rounded-2xl px-4 py-5 text-center" style={look(FAMILY.violet)}>
          <p className="text-sm" style={{ color: B.muted }}>No dishes planned for the next 7 days.</p>
        </section>
      ) : menuDays.map((d) => (
        <section key={d.date} className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.blue)}>
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>{d.label}</h2>
          {d.dishes.map((dish) => (
            <div key={dish.name} className="grid gap-1.5" style={{ borderTop: `1px solid ${FAMILY.blue.line}`, paddingTop: 8 }}>
              <p className="text-sm font-medium" style={{ color: B.ink }}>{dish.name}</p>
              {dish.ings.length === 0 ? (
                <p className="text-[11px]" style={{ color: B.muted2 }}>No ingredient list for this dish.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {dish.ings.map((ing) => {
                    const st = ingState(ing);
                    const f = chip(st);
                    const body = `${st === "have" ? "✓ " : st === "listed" ? "✓ " : "＋ "}${ing.charAt(0).toUpperCase() + ing.slice(1)}`;
                    return st === "short" ? (
                      <button key={ing} onClick={() => addFromMenu(ing.charAt(0).toUpperCase() + ing.slice(1))} disabled={busy}
                        className="px-2.5 py-1 rounded-full text-xs font-medium disabled:opacity-60"
                        style={{ background: "#fff", color: f.ink, border: `2px solid ${f.edge}` }}>{body}</button>
                    ) : (
                      <span key={ing} className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: f.bg, color: f.ink, border: `2px solid ${f.edge}` }}>{body}</span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );

  // Step 3 · what to buy
  const shopStep = (
    <div className="grid gap-4">
      <section className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.blue)}>
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
          <p className="text-sm" style={{ color: B.muted }}>{bought.length ? "Everything is bought." : "Nothing to buy · Flagged items appear here."}</p>
        ) : (
          <div className="grid">
            {open.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${FAMILY.blue.line}` }}>
                <button onClick={() => markBought(s)} disabled={busy}
                  className="w-6 h-6 shrink-0 rounded-md" style={{ border: `2px solid ${B.violet}` }}
                  aria-label={`Bought ${s.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: B.ink }}>
                    {s.name}{s.quantity ? ` — ${amount(s.quantity, s.unit)}` : ""}
                  </p>
                </div>
                <button onClick={() => removeFromList(s)} className="w-7 h-7 rounded-lg text-xs shrink-0"
                  style={{ background: "#FBE2DC", color: "#9A2C1B" }} aria-label={`Remove ${s.name}`}>✕</button>
              </div>
            ))}
          </div>
        )}

        {bought.length > 0 && (
          <div className="grid">
            <p className="text-[11px] font-semibold uppercase tracking-wider pt-1" style={{ color: FAMILY.green.ink }}>
              Bought · {bought.length}
            </p>
            {bought.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${FAMILY.blue.line}` }}>
                <button onClick={() => unbuy(s)} disabled={busy}
                  className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
                  style={{ background: FAMILY.green.edge, border: `2px solid ${FAMILY.green.edge}` }}
                  aria-label={`${s.name} is bought, tap to put it back`}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <p className="min-w-0 flex-1 text-sm truncate" style={{ color: B.muted2, textDecoration: "line-through" }}>
                  {s.name}{s.quantity ? ` — ${amount(s.quantity, s.unit)}` : ""}
                </p>
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
            style={fieldLook(FAMILY.blue)} />
          <button onClick={addToList} disabled={busy || !buyName.trim()}
            className="px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: B.button }}>
            Add
          </button>
        </div>
      </section>

      {isPrime && (
        <section className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.violet)}>
          {/* The camera and the file chooser are two different doors, so a
              tap lands where the words promised */}
          <input ref={billCamRef} type="file" accept="image/*" capture="environment"
            onChange={handleBillPhoto} className="hidden" />
          <input ref={billRef} type="file" accept="image/*,application/pdf"
            onChange={handleBillPhoto} className="hidden" />

          {!bill && (
            <>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>Back from the shop?</h2>
                <p className="text-[11px]" style={{ color: B.muted2 }}>
                  Photo or PDF of the bill → shelf.
                </p>
              </div>
              {reading ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 py-2.5 text-sm font-medium" style={{ color: B.violet }}>
                    Reading the bill…
                  </span>
                  <button onClick={stopReading}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: B.tint, color: B.violet }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button onClick={() => billCamRef.current?.click()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{ background: B.button }}>
                      📷 Take a photo
                    </button>
                    <button onClick={() => billRef.current?.click()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: B.tint, color: B.violet }}>
                      📄 Choose a file
                    </button>
                  </div>
                  <p className="text-[11px] m-0" style={{ color: B.muted2 }}>
                    The camera or the file list is your phone&apos;s own, not ours — press your
                    phone&apos;s back button to close it. Nothing happens here until you pick something.
                  </p>
                </>
              )}
            </>
          )}

          {billNote && (
            <p className="text-xs rounded-xl px-3 py-2"
              style={{ background: B.goldTint, color: B.goldInk }}>{billNote}</p>
          )}

          {bill && (
            <>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>
                  On the bill{bill.shop ? ` · ${bill.shop}` : ""}
                </h2>
                <p className="text-[11px]" style={{ color: B.muted2 }}>
                  Untick what doesn&apos;t belong, then put away.
                </p>
              </div>

              <div className="grid">
                {bill.lines.map((line, idx) => {
                  const shelf = line.matchId ? items.find((i) => i.id === line.matchId) : undefined;
                  const set = (changes: Partial<BillLine>) =>
                    setBill((b) => b && { ...b, lines: b.lines.map((l, i) => (i === idx ? { ...l, ...changes } : l)) });
                  return (
                    <div key={`${line.name}-${idx}`} className="flex items-center gap-2 py-2"
                      style={{ borderTop: `1px solid ${FAMILY.violet.line}` }}>
                      <button onClick={() => set({ take: !line.take })} aria-pressed={line.take}
                        className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
                        style={{ background: line.take ? B.violet : "transparent", border: `2px solid ${line.take ? B.violet : FAMILY.violet.edge}` }}
                        aria-label={`${line.take ? "Skip" : "Keep"} ${line.name}`}>
                        {line.take && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ color: line.take ? B.ink : B.muted2 }}>{line.name}</p>
                        <p className="text-[11px]" style={{ color: B.muted2 }}>
                          {shelf
                            ? `Tops up ${shelf.name}${shelf.kind !== "sundry" && line.quantity != null && inShelfUnit(line.quantity, line.unit, shelf.unit) != null
                                ? ` · ${amount(shelf.quantity, shelf.unit)} → ${amount(Math.round(((shelf.quantity ?? 0) + inShelfUnit(line.quantity, line.unit, shelf.unit)!) * 100) / 100, shelf.unit)}`
                                : ""}`
                            : `New · ${categoryLabel(line.category)}`}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums shrink-0" style={{ color: B.muted }}>
                        {amount(line.quantity, line.unit)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={applyBill} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: B.button }}>
                  {busy ? "Putting away…" : `Put ${bill.lines.filter((l) => l.take).length} away`}
                </button>
                <button onClick={() => setBill(null)} className="px-4 text-sm font-semibold" style={{ color: B.muted }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );

  // ── The hub, and the step you opened ────────────────────────
  if (step === null) {
    return (
      <div className="grid gap-3">
        {STEPS.map((s) => (
          <button key={s.key} onClick={() => setStep(s.key)}
            className="w-full text-left rounded-2xl px-4 py-4 flex items-center gap-3"
            style={look(s.tone)} aria-label={`${s.title}: ${s.ask}`}>
            <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: s.tone.edge }}>{s.n}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold uppercase tracking-wider" style={{ color: s.tone.ink }}>{s.title}</span>
              <span className="block text-sm" style={{ color: B.ink }}>{s.ask}</span>
              <span className="block text-[11px]" style={{ color: B.muted2 }}>{s.line}</span>
            </span>
            <Arrow dir="right" tone={s.tone} />
          </button>
        ))}
      </div>
    );
  }

  const idx = STEPS.findIndex((s) => s.key === step);
  const cur = STEPS[idx];
  const next = STEPS[idx + 1];
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(null)} className="flex items-center gap-2" aria-label="Back to the three steps">
          <Arrow dir="left" tone={cur.tone} />
          <span className="text-xs font-semibold" style={{ color: B.violetLink }}>All steps</span>
        </button>
        <p className="flex-1 text-right text-sm font-bold uppercase tracking-wider" style={{ color: cur.tone.ink }}>
          {cur.n} · {cur.title}
        </p>
      </div>

      {step === "shelf" ? shelfStep : step === "menu" ? menuStep : shopStep}

      {next && (
        <button onClick={() => { setStep(next.key); if (typeof window !== "undefined") window.scrollTo({ top: 0 }); }}
          className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left" style={look(next.tone)}>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px]" style={{ color: B.muted2 }}>Next</span>
            <span className="block text-sm font-bold" style={{ color: next.tone.ink }}>{next.n} · {next.title} — {next.ask}</span>
          </span>
          <Arrow dir="right" tone={next.tone} />
        </button>
      )}
    </div>
  );
}
