"use client";

import { Fragment, useRef, useState } from "react";
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

/** One dated purchase of a shelf item, from a bill or a "bought" tick. */
export type Purchase = {
  id: string; pantry_item_id: string; quantity: number | null; unit: Unit | null; bought_on: string; shop: string | null;
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
  kutumbhId, userId, isPrime, initialItems, initialShopping, initialPurchases, menuDays, memberNames, today,
}: {
  kutumbhId: string; userId: string; isPrime: boolean;
  initialItems: PantryItem[]; initialShopping: ShoppingItem[]; initialPurchases: Purchase[];
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
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<null | "shelf" | "menu" | "shop">(null);
  const [tab, setTab] = useState<"staple" | "veg" | "dairy" | "spice">("staple");
  const [purchases, setPurchases] = useState(initialPurchases);
  const [openId, setOpenId] = useState<string | null>(null);              // the shelf item opened for detail
  const [stockDraft, setStockDraft] = useState({ quantity: "", low_when: "", category: "" });
  const [boughtDraft, setBoughtDraft] = useState("");                      // "bought today" amount in the detail panel
  const [tickId, setTickId] = useState<string | null>(null);               // the list line being ticked bought
  const [tickQty, setTickQty] = useState("");

  // Reading a shop bill
  const billRef = useRef<HTMLInputElement>(null);
  const billCamRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [billNote, setBillNote] = useState<string | null>(null);
  const [bill, setBill] = useState<{ shop: string | null; lines: BillLine[] } | null>(null);

  const open = shopping.filter((s) => s.status === "open");

  // What the next seven days' dishes need that is neither on the shelf nor already on the list
  const shelfNames = items.filter((i) => !isLow(i)).map((i) => i.name);
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
      low_when: kind !== "sundry" ? (seed?.low_when ?? (draft.low_when ? parseFloat(draft.low_when) : null)) : null,
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

  // ── The register: purchases in, stock now ───────────────────
  const ITEM_COLS = "id, name, kind, category, quantity, unit, low_when, status, bought_on, use_within_days, note";
  const SHOP_COLS = "id, name, quantity, unit, source, status, pantry_item_id, requested_by, created_at, bought_at";

  /** Re-read the shelf, the list and the purchases after a change made on the server. */
  async function reloadAll() {
    const [a, b, c] = await Promise.all([
      supabase.from("pantry_items").select(ITEM_COLS).eq("kutumbh_id", kutumbhId).order("name"),
      supabase.from("shopping_items").select(SHOP_COLS).eq("kutumbh_id", kutumbhId).order("created_at", { ascending: false }).limit(120),
      supabase.from("pantry_purchases").select("id, pantry_item_id, quantity, unit, bought_on, shop")
        .eq("kutumbh_id", kutumbhId).order("bought_on", { ascending: false }).order("created_at", { ascending: false }).limit(600),
    ]);
    if (a.data) setItems(a.data as PantryItem[]);
    if (b.data) setShopping(b.data as ShoppingItem[]);
    if (c.data) setPurchases(c.data as Purchase[]);
  }

  /** Bought: a dated purchase, stock goes up, the item is OK again and comes off the list. */
  async function recordPurchase(item: PantryItem, qty: number | null, shop: string | null = null, on: string = today) {
    const { error } = await supabase.rpc("record_purchase", {
      p_item: item.id, p_qty: qty, p_unit: item.unit, p_on: on, p_shop: shop,
    });
    return error?.message ?? null;
  }

  /** The Key Member corrects what is on the shelf now, and where "low" begins for this item. */
  async function saveStock(item: PantryItem) {
    const q = stockDraft.quantity.trim() === "" ? null : parseFloat(stockDraft.quantity);
    const l = stockDraft.low_when.trim() === "" ? null : parseFloat(stockDraft.low_when);
    const category = stockDraft.category || item.category;
    const kind = kindOf(category);
    const moved = kind !== item.kind;
    const changes: Partial<PantryItem> = kind === "sundry"
      ? { category, kind, quantity: null, unit: null, low_when: null }
      : {
          category, kind, quantity: q, low_when: l,
          unit: item.unit ?? (category === "dairy" ? "l" : "kg"),
          ...(moved && kind === "fresh" ? { bought_on: today, use_within_days: SHELF_LIFE[category] ?? 5 } : {}),
        };
    const next = { ...item, ...changes };
    await patch(item.id, { ...changes, status: isLow({ ...next, status: "ok" }) ? item.status : "ok" });
    setOpenId(null);
  }

  async function boughtNow(item: PantryItem) {
    if (busy) return;
    setBusy(true);
    const q = boughtDraft.trim() === "" ? null : parseFloat(boughtDraft);
    const err = await recordPurchase(item, q);
    if (err) return fail("record that", err);
    await reloadAll();
    setBoughtDraft("");
    setBusy(false);
  }

  /** Ticked on the shopping list: it was bought. The amount is asked, but may be skipped. */
  async function tickBought(s: ShoppingItem) {
    if (busy) return;
    setBusy(true);
    const q = tickQty.trim() === "" ? null : parseFloat(tickQty);
    const shelf = (s.pantry_item_id && items.find((i) => i.id === s.pantry_item_id)) || findMatch(s.name, items);
    if (shelf) {
      const err = await recordPurchase(shelf, q);
      if (err) return fail("record that", err);
    }
    // Lines not tied to a shelf item (or tied by name only) are closed here
    await supabase.from("shopping_items")
      .update({ status: "bought", bought_by: userId, bought_at: new Date().toISOString(), quantity: q ?? s.quantity })
      .eq("id", s.id).eq("status", "open");
    await reloadAll();
    setTickId(null); setTickQty("");
    setBusy(false);
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
    const shelf = findMatch(name, items);
    if (shelf) return flagLow(shelf);          // tied to the shelf item, so buying it tops the shelf up
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

  /** Unticked on the Menu step: it comes off the list again. */
  async function dropFromMenu(name: string) {
    if (busy) return;
    const rows = open.filter((s) => haveIt(name, [s.name]));
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("shopping_items").delete().in("id", rows.map((r) => r.id));
    if (error) return fail("take that off the list", error.message);
    setShopping((prev) => prev.filter((x) => !rows.some((r) => r.id === x.id)));
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
        return { ...i, take: !!match, matchId: match?.id ?? null };   // new things wait to be confirmed
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

  /** Put the ticked lines on the shelf: each one a dated purchase; new things get a row first. */
  async function applyBill() {
    if (!bill || busy) return;
    const take = bill.lines.filter((l) => l.take);
    if (take.length === 0) { setBill(null); return; }
    setBusy(true);

    for (const line of take) {
      let shelf = line.matchId ? items.find((i) => i.id === line.matchId) : undefined;
      if (!shelf) {
        const kind = kindOf(line.category);
        const { data, error } = await supabase.from("pantry_items").insert({
          kutumbh_id: kutumbhId, name: line.name, kind, category: line.category,
          quantity: kind === "sundry" ? null : 0, unit: kind === "sundry" ? null : line.unit,
          use_within_days: kind === "fresh" ? SHELF_LIFE[line.category] ?? 5 : null,
          updated_by: userId,
        }).select(ITEM_COLS).single();
        if (error || !data) return fail("add that item", error?.message ?? "unknown");
        shelf = data as PantryItem;
      }
      const qty = line.quantity == null ? null
        : shelf.kind === "sundry" ? line.quantity                       // kept in the history; spices aren't weighed on the shelf
        : inShelfUnit(line.quantity, line.unit, shelf.unit) ?? (shelf.unit ? null : line.quantity);
      const err = await recordPurchase(shelf, qty, bill.shop);
      if (err) return fail("record the bill", err);
    }

    // Anything on the list bought by another name comes off it too
    const boughtNames = new Set(take.map((l) => norm(l.name)));
    const done = open.filter((s) => boughtNames.has(norm(s.name)));
    if (done.length) {
      await supabase.from("shopping_items")
        .update({ status: "bought", bought_by: userId, bought_at: new Date().toISOString() })
        .in("id", done.map((s) => s.id));
    }
    await reloadAll();
    setBill(null);
    setBillNote(`${take.length} item${take.length > 1 ? "s" : ""} recorded on the shelf.`);
    setBusy(false);
  }

  // ── The register ────────────────────────────────────────────
  const shortDate = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const boughtOf = (id: string) => purchases.filter((p) => p.pantry_item_id === id);   // newest first
  const onList = (item: PantryItem) =>
    open.some((s) => s.pantry_item_id === item.id || norm(s.name) === norm(item.name));
  const RED = { bg: "#FBE2DC", fg: "#9A2C1B", edge: "#D2553C" };

  function BoughtCell({ p }: { p?: Purchase }) {
    if (!p) return <span className="text-xs text-center" style={{ color: B.muted2 }}>—</span>;
    return (
      <span className="grid text-center leading-tight">
        <span className="text-xs tabular-nums" style={{ color: B.ink }}>{p.quantity != null ? amount(p.quantity, p.unit) : "✓"}</span>
        <span className="text-[10px]" style={{ color: B.muted2 }}>{shortDate(p.bought_on)}</span>
      </span>
    );
  }

  function StockCell({ item }: { item: PantryItem }) {
    const low = isLow(item);
    const label = item.quantity != null ? amount(item.quantity, item.unit) : STATUS_STYLE[item.status].label;
    if (!low) return <span className="text-sm font-semibold tabular-nums text-center" style={{ color: B.ink }}>{label || "—"}</span>;
    if (onList(item)) {
      return (
        <span className="rounded-lg px-1 py-1 text-center leading-tight" style={{ background: B.goldTint, color: B.goldInk }}>
          <span className="block text-xs font-semibold tabular-nums">{label}</span>
          <span className="block text-[10px] font-semibold">on list</span>
        </span>
      );
    }
    // Red: one tap puts it on the shopping list
    return (
      <button onClick={() => flagLow(item)} disabled={busy}
        className="rounded-lg px-1 py-1 text-center leading-tight disabled:opacity-60"
        style={{ background: RED.bg, color: RED.fg, border: `1.5px solid ${RED.edge}` }}
        aria-label={`${item.name} is low — add to the shopping list`}>
        <span className="block text-xs font-bold tabular-nums">{label}</span>
        <span className="block text-[10px] font-semibold">+ list</span>
      </button>
    );
  }

  function openDetail(item: PantryItem) {
    if (openId === item.id) { setOpenId(null); return; }
    setOpenId(item.id);
    setStockDraft({ quantity: item.quantity != null ? String(item.quantity) : "", low_when: item.low_when != null ? String(item.low_when) : "", category: item.category });
    setBoughtDraft("");
  }

  /** The opened item: record a purchase, correct the shelf, see its history. */
  function detailPanel(item: PantryItem) {
    const bought = boughtOf(item.id);
    return (
          <div className="rounded-xl px-3 py-3 mb-2 grid gap-3" style={{ background: "#FFFFFF", border: `1px solid ${B.cardEdge}` }}>
            <div className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider m-0" style={{ color: B.muted }}>Bought now?</p>
              <div className="flex gap-1.5">
                <input type="number" inputMode="decimal" min="0" step="0.25" value={boughtDraft}
                  onChange={(e) => setBoughtDraft(e.target.value)} placeholder="How much"
                  aria-label={`Amount of ${item.name} bought`}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.amber)} />
                <span className="self-center text-sm" style={{ color: B.muted }}>{item.unit ?? ""}</span>
                <button onClick={() => boughtNow(item)} disabled={busy}
                  className="px-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: B.button }}>
                  Record
                </button>
              </div>
            </div>

            {isPrime && (
              <div className="grid gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider m-0" style={{ color: B.muted }}>Correct the shelf</p>
                <label className="grid gap-0.5 text-[11px]" style={{ color: B.muted }}>
                  Kind (which tab it sits in)
                  <select value={stockDraft.category} onChange={(e) => setStockDraft({ ...stockDraft, category: e.target.value })}
                    className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.amber)}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
                {kindOf(stockDraft.category || item.category) !== "sundry" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="grid gap-0.5 text-[11px]" style={{ color: B.muted }}>
                    Current stock ({item.unit ?? "—"})
                    <input type="number" inputMode="decimal" min="0" step="0.25" value={stockDraft.quantity}
                      onChange={(e) => setStockDraft({ ...stockDraft, quantity: e.target.value })}
                      className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.amber)} />
                  </label>
                  <label className="grid gap-0.5 text-[11px]" style={{ color: B.muted }}>
                    Low at ({item.unit ?? "—"})
                    <input type="number" inputMode="decimal" min="0" step="0.25" value={stockDraft.low_when}
                      onChange={(e) => setStockDraft({ ...stockDraft, low_when: e.target.value })}
                      className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.amber)} />
                  </label>
                </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => saveStock(item)} disabled={busy}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: B.button }}>
                    Save
                  </button>
                  <button onClick={() => removeItem(item)} className="px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: RED.bg, color: RED.fg }}>Remove item</button>
                </div>
              </div>
            )}

            <div className="grid gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider m-0" style={{ color: B.muted }}>Purchases</p>
              {bought.length === 0 ? (
                <p className="text-xs m-0" style={{ color: B.muted2 }}>None recorded yet.</p>
              ) : bought.slice(0, 12).map((p) => (
                <p key={p.id} className="text-xs m-0 flex justify-between gap-2" style={{ color: B.ink }}>
                  <span>{shortDate(p.bought_on)}{p.shop ? ` · ${p.shop}` : ""}</span>
                  <span className="tabular-nums">{p.quantity != null ? amount(p.quantity, p.unit) : "—"}</span>
                </p>
              ))}
            </div>
          </div>
    );
  }

  function RegisterRow({ item }: { item: PantryItem }) {
    const bought = boughtOf(item.id);
    const left = item.kind === "fresh" ? daysLeft(item.bought_on, item.use_within_days, today) : null;
    const opened = openId === item.id;
    return (
      <div style={{ borderTop: `1px solid ${B.cardEdge}` }}>
        <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_76px] gap-x-1.5 items-center py-2">
          <button onClick={() => openDetail(item)} className="min-w-0 text-left" aria-expanded={opened}>
            <span className="block text-sm font-medium truncate" style={{ color: B.ink }}>{item.name}</span>
            <span className="block text-[10px] truncate" style={{ color: left != null && left <= 1 ? RED.fg : B.muted2 }}>
              {left != null
                ? (left < 0 ? "past its days" : left === 0 ? "use today" : `use within ${left}d`)
                : item.low_when != null ? `low at ${amount(item.low_when, item.unit)}` : categoryLabel(item.category)}
            </span>
          </button>
          <BoughtCell p={bought[1]} />
          <BoughtCell p={bought[0]} />
          <StockCell item={item} />
        </div>

        {opened && detailPanel(item)}
      </div>
    );
  }

  /** Spices aren't weighed: a chip that is green when fine, red when low or out. */
  function SundryChip({ item }: { item: PantryItem }) {
    const low = item.status !== "ok";
    const listed = low && onList(item);
    const style = !low ? { background: "#E3F0E2", color: "#2F6B33", border: "1px solid #B9D8B6" }
      : listed ? { background: B.goldTint, color: B.goldInk, border: `1px solid ${B.goldInk}` }
      : { background: RED.bg, color: RED.fg, border: `1.5px solid ${RED.edge}` };
    const last = boughtOf(item.id)[0];
    return (
      <button onClick={() => (!listed ? flagLow(item) : undefined)} disabled={busy || listed}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium disabled:opacity-100"
        style={style}
        aria-label={!low ? `${item.name} is fine — tap if it is running low` : listed ? `${item.name} is on the list` : `${item.name} is low — add to the list`}>
        <span>{item.name}</span>
        <span className="text-[10px] font-bold uppercase">
          {!low ? (last ? shortDate(last.bought_on) : "OK") : listed ? "on list" : "+ list"}
        </span>
      </button>
    );
  }

  // ── The steps ───────────────────────────────────────────────
  const TABS = [
    { key: "staple", label: "Staples",      hint: "Rice, dals, atta, oil, sugar",                     tone: KIND_LOOK.staple, match: (i: PantryItem) => i.kind === "staple" },
    { key: "veg",    label: "Veg & Fruits", hint: "Vegetables, greens and fruit — used soon",        tone: KIND_LOOK.fresh,  match: (i: PantryItem) => i.kind === "fresh" && i.category !== "dairy" },
    { key: "dairy",  label: "Dairy",        hint: "Milk, curd, paneer, butter — bought most days",   tone: { bg: FAMILY.violet.bg, edge: FAMILY.violet.edge, ink: FAMILY.violet.ink }, match: (i: PantryItem) => i.kind === "fresh" && i.category === "dairy" },
    { key: "spice",  label: "Spices",       hint: "Not weighed · tap one when it runs low",          tone: KIND_LOOK.sundry, match: (i: PantryItem) => i.kind === "sundry" },
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
              <div className="grid gap-2 pt-1">
                <div className="flex flex-wrap gap-2">{tabRows.map((i) => <SundryChip key={i.id} item={i} />)}</div>
                {isPrime && (
                  <label className="text-[11px] grid gap-1" style={{ color: B.muted2 }}>
                    Open one to correct it or move it to another tab
                    <select value={tabRows.some((i) => i.id === openId) ? openId! : ""}
                      onChange={(e) => { const it = tabRows.find((i) => i.id === e.target.value); if (it) openDetail(it); else setOpenId(null); }}
                      className="rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.amber)}>
                      <option value="">Choose a spice…</option>
                      {tabRows.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </label>
                )}
                {(() => { const it = tabRows.find((i) => i.id === openId); return it ? detailPanel(it) : null; })()}
              </div>
            ) : (
              <div className="grid">
                <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_76px] gap-x-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: current.tone.ink }}>
                  <span>Item</span><span className="text-center">Bought 1</span><span className="text-center">Bought 2</span>
                  <span className="text-center">Current stock</span>
                </div>
                {tabRows.map((i) => <Fragment key={i.id}>{RegisterRow({ item: i })}</Fragment>)}
                <p className="text-[10px] pt-2 m-0" style={{ color: B.muted2 }}>
                  Tap an item to record a purchase{isPrime ? ", correct its stock or set when it is low" : ""}. Red = low · tap it to add to the list.
                </p>
              </div>
            )}
          </section>
        </>
      )}

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
                  Check the amounts, confirm any new items, then record.
                </p>
              </div>

              {(() => {
                const setLine = (idx: number, changes: Partial<BillLine>) =>
                  setBill((b) => b && { ...b, lines: b.lines.map((l, i) => (i === idx ? { ...l, ...changes } : l)) });
                const Tick = ({ line, idx }: { line: BillLine; idx: number }) => (
                  <button onClick={() => setLine(idx, { take: !line.take })} aria-pressed={line.take}
                    className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
                    style={{ background: line.take ? B.violet : "#fff", border: `2px solid ${line.take ? B.violet : FAMILY.violet.edge}` }}
                    aria-label={`${line.take ? "Skip" : "Take"} ${line.name}`}>
                    {line.take && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
                const known = bill.lines.map((l, idx) => ({ l, idx })).filter(({ l }) => l.matchId);
                const fresh = bill.lines.map((l, idx) => ({ l, idx })).filter(({ l }) => !l.matchId);
                const allNewOn = fresh.length > 0 && fresh.every(({ l }) => l.take);
                return (
                  <>
                    {known.length > 0 && (
                      <div className="grid">
                        <p className="text-[11px] font-semibold uppercase tracking-wider m-0 pb-1" style={{ color: B.violet }}>
                          Already on the shelf · {known.length}
                        </p>
                        {known.map(({ l: line, idx }) => {
                          const shelf = items.find((i) => i.id === line.matchId)!;
                          const add = line.quantity != null ? inShelfUnit(line.quantity, line.unit, shelf.unit) : null;
                          return (
                            <div key={`k-${idx}`} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${FAMILY.violet.line}` }}>
                              <Tick line={line} idx={idx} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate m-0" style={{ color: line.take ? B.ink : B.muted2 }}>{line.name}</p>
                                <p className="text-[11px] m-0" style={{ color: B.muted2 }}>
                                  {shelf.name}{shelf.kind !== "sundry" && add != null
                                    ? ` · ${amount(shelf.quantity, shelf.unit) || "0"} → ${amount(Math.round(((shelf.quantity ?? 0) + add) * 100) / 100, shelf.unit)}`
                                    : ""}
                                </p>
                              </div>
                              <span className="text-xs tabular-nums shrink-0" style={{ color: B.muted }}>{amount(line.quantity, line.unit)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {fresh.length > 0 && (
                      <div className="grid rounded-xl px-3 py-2" style={{ background: B.goldTint }}>
                        <div className="flex items-center justify-between gap-2 pb-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wider m-0" style={{ color: B.goldInk }}>
                            New to the shelf · {fresh.length} — add {fresh.length > 1 ? "these" : "this"}?
                          </p>
                          {fresh.length > 1 && (
                            <button onClick={() => setBill((b) => b && { ...b, lines: b.lines.map((l) => (l.matchId ? l : { ...l, take: !allNewOn })) })}
                              className="text-[11px] font-semibold shrink-0" style={{ color: B.violetLink }}>
                              {allNewOn ? "Untick all" : "Tick all"}
                            </button>
                          )}
                        </div>
                        {fresh.map(({ l: line, idx }) => (
                          <div key={`n-${idx}`} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${FAMILY.gold.line}` }}>
                            <Tick line={line} idx={idx} />
                            <div className="min-w-0 flex-1 grid gap-1">
                              <p className="text-sm truncate m-0" style={{ color: line.take ? B.ink : B.muted2 }}>{line.name}</p>
                              {/* Which tab it lands in */}
                              <select value={line.category} onChange={(e) => setLine(idx, { category: e.target.value })}
                                aria-label={`Kind of ${line.name}`} className="rounded-lg px-2 py-1 text-xs w-fit max-w-full"
                                style={fieldLook(FAMILY.amber)}>
                                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                              </select>
                            </div>
                            <span className="text-xs tabular-nums shrink-0" style={{ color: B.muted }}>{amount(line.quantity, line.unit)}</span>
                          </div>
                        ))}
                        <p className="text-[10px] m-0 pt-1" style={{ color: B.goldInk }}>
                          Ticked ones get their own row on the shelf. Unticked ones are left off.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex gap-2">
                <button onClick={applyBill} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: B.button }}>
                  {busy ? "Putting away…" : (() => {
                    const k = bill.lines.filter((l) => l.take && l.matchId).length;
                    const n = bill.lines.filter((l) => l.take && !l.matchId).length;
                    return [k ? `Record ${k}` : "", n ? `add ${n} new` : ""].filter(Boolean).join(" · ") || "Nothing ticked";
                  })()}
                </button>
                <button onClick={() => setBill(null)} className="px-4 text-sm font-semibold" style={{ color: B.muted }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
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

              {kindOf(draft.category) !== "sundry" && (
                <div className="grid gap-1">
                  <label htmlFor="p-low" className="text-xs font-medium" style={{ color: B.muted }}>
                    Low at (turns red here)
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
              Next 7 days · <span style={{ color: FAMILY.green.ink }}>on the shelf</span> · <span style={{ color: FAMILY.gold.ink }}>ticked = on the shopping list</span> · <span style={{ color: FAMILY.red.ink }}>short</span>
            </p>
          </div>
          {needed.length > 0 && (
            <button onClick={addAllFromMenu} disabled={busy}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: B.button }}>
              Tick all
            </button>
          )}
        </div>
        <p className="text-[11px]" style={{ color: B.muted2 }}>
          Tick what to buy; untick and it leaves the list. Amounts are left to you — a family pot is never one recipe.
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
                    const nice = ing.charAt(0).toUpperCase() + ing.slice(1);
                    if (st === "have") {
                      return (
                        <span key={ing} className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: f.bg, color: f.ink, border: `2px solid ${f.edge}` }}>✓ {nice} · on shelf</span>
                      );
                    }
                    const ticked = st === "listed";
                    return (
                      <button key={ing} onClick={() => (ticked ? dropFromMenu(ing) : addFromMenu(nice))} disabled={busy}
                        aria-pressed={ticked}
                        className="px-2.5 py-1 rounded-full text-xs font-medium disabled:opacity-60"
                        style={ticked
                          ? { background: FAMILY.gold.edge, color: "#fff", border: `2px solid ${FAMILY.gold.edge}` }
                          : { background: "#fff", color: FAMILY.red.ink, border: `2px solid ${FAMILY.red.edge}` }}>
                        {ticked ? "✓ " : "☐ "}{nice}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      <section className="rounded-2xl px-4 py-4 grid gap-2" style={look(FAMILY.amber)}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: B.violet }}>Something else to buy?</h2>
        <div className="flex gap-2">
          <label htmlFor="buy-name" className="sr-only">Add to the shopping list</label>
          <input id="buy-name" value={buyName} onChange={(e) => setBuyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addToList(); }}
            placeholder="Add something to buy…" maxLength={60}
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm"
            style={fieldLook(FAMILY.amber)} />
          <button onClick={addToList} disabled={busy || !buyName.trim()}
            className="px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: B.button }}>
            Add
          </button>
        </div>
      </section>
    </div>
  );

  // Step 3 · the list, finished: what to buy, and nothing else
  const shopStep = (
    <div className="grid gap-4">
      <section className="rounded-2xl px-4 py-4 grid gap-3" style={look(FAMILY.green)}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: FAMILY.green.ink }}>
            Shopping list{open.length ? ` · ${open.length}` : ""}
          </h2>
          {open.length > 0 && (
            <button onClick={copyList} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: B.button }}>
              {copied ? "Copied ✓" : "Copy list"}
            </button>
          )}
        </div>

        {open.length === 0 ? (
          <p className="text-sm" style={{ color: B.muted }}>Nothing to buy · Tap a red item on the Shelf, or tick what the Menu needs.</p>
        ) : (
          <div className="grid">
            {open.map((s) => {
              const shelf = (s.pantry_item_id && items.find((i) => i.id === s.pantry_item_id)) || findMatch(s.name, items);
              const ticking = tickId === s.id;
              return (
                <div key={s.id} className="py-2.5 grid gap-2" style={{ borderTop: `1px solid ${FAMILY.green.line}` }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setTickId(ticking ? null : s.id); setTickQty(""); }}
                      className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-sm font-bold"
                      style={{ background: ticking ? FAMILY.green.edge : "#fff", color: ticking ? "#fff" : FAMILY.green.edge, border: `2px solid ${FAMILY.green.edge}` }}
                      aria-label={`Bought ${s.name}`}>✓</button>
                    <p className="min-w-0 flex-1 text-sm m-0" style={{ color: B.ink }}>
                      {s.name}{s.quantity ? ` — ${amount(s.quantity, s.unit)}` : ""}
                    </p>
                    <button onClick={() => removeFromList(s)} className="w-8 h-8 rounded-lg text-sm shrink-0"
                      style={{ background: "#FBE2DC", color: "#9A2C1B" }} aria-label={`Remove ${s.name}`}>✕</button>
                  </div>
                  {ticking && (
                    <div className="flex gap-1.5 pl-9">
                      <input type="number" inputMode="decimal" min="0" step="0.25" value={tickQty} autoFocus
                        onChange={(e) => setTickQty(e.target.value)} placeholder="How much? (optional)"
                        aria-label={`Amount of ${s.name} bought`}
                        className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm" style={fieldLook(FAMILY.green)} />
                      <span className="self-center text-sm" style={{ color: B.muted }}>{shelf?.unit ?? s.unit ?? ""}</span>
                      <button onClick={() => tickBought(s)} disabled={busy}
                        className="px-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: B.button }}>
                        Bought
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
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
