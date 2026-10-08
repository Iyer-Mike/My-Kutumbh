"use client";

import { addDays } from "@/lib/weeks";
import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FAMILY, look } from "@/lib/brand";
import { SLOTS } from "@/lib/meal-slots";
import { dayLabel } from "@/lib/dates";
import { useFamilyTimeZone } from "@/lib/family-time";
import { scaled, sum, type Nutr } from "@/lib/serving-nutrition";
import PlanSlotCard, { type PlanItem, type QuickPick } from "./PlanSlotCard";

export type MealSuggestion = {
  meal_slot: string;
  source: "planned" | "same_weekday" | "last_time";
  based_on: string;
  total_kcal: number | string | null;
  items: {
    food_item_id: string | null;
    food_name: string;
    quantity_g: number | null;
    quantity_unit: string | null;
    calories: number | null;
  }[];
};

type Log = {
  id: string;
  food_item_id: string | null;
  food_name: string;
  meal_slot: string;
  quantity_g: number;
  quantity_unit: string | null;
  calories: number | null;
  nutrition_estimated: boolean | null;
  recipe_id?: number | null;
  n: Nutr | null;
};


type Plan = PlanItem & { meal_slot: string; food_item_id: string | null; n: Nutr | null };

type Props = {
  logs: Log[];
  suggestions: MealSuggestion[];
  dailyKcalGoal: number | null;
  /** Day needs from the profile (ICMR-NIN): each meal gets a share */
  targets: Targets;
  day: string;
  today: string;
  tomorrow: string;
  isPrime: boolean;
  festivalTab: string | null;
  quickPicks: Record<string, QuickPick[]>;
  quickLabel: string;
  plans: Plan[];
  poolNames: Record<string, string>;
  memberNames: Record<string, string>;
  userId: string;
  kutumbhId: string | null;
};

function whyText(s: MealSuggestion): string {
  if (s.source === "planned") return "Planned by the family";
  if (s.source === "same_weekday") {
    const d = new Date(`${s.based_on}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
    return `Same as last ${d}`;
  }
  return "Same as last time";
}

// Quantity: grams for dishes counted per 100 g, otherwise servings (or pieces, bowls…)
const defQty = (unit: string | null) => (unit === "g" ? 100 : 1);
const stepOf = (unit: string | null) => (unit === "g" ? 25 : unit === "tbsp" ? 1 : 0.5);
const timesOf = (l: { quantity_g: number; quantity_unit: string | null }) =>
  (Number(l.quantity_g) || 1) / (l.quantity_unit === "g" ? 100 : 1);
const qtyText = (q: number, unit: string | null) => {
  const n = q === 0.5 ? "½" : q === 1.5 ? "1½" : String(Math.round(q * 10) / 10);
  const u = unit ?? "serving";
  return u === "g" || u === "tbsp" || q <= 1 ? `${n} ${u}` : `${n} ${u}s`;
};

const same = (p: Plan, l: Log) =>
  p.food_item_id && l.food_item_id ? p.food_item_id === l.food_item_id : p.food_name.toLowerCase() === l.food_name.toLowerCase();

// Two clearly different card families: warm for the day's values, cool for the meals
export const WARM = { bg: "#FFE9C7", edge: "#C2551F" };
export const COOL = { bg: "#E8F2FD", edge: "#2E64A0", open: "#D3E6FA" };

type Targets = { kcal: number; p: number; c: number; fi: number; fat: number; fe: number; ca: number; b12: number; na: number; k: number };
type Row = { name: string; key: keyof Nutr; tkey: keyof Targets; unit: string; limit?: boolean };
// Five always on show; the rest behind "See more"
const VALUE_ROWS: Row[] = [
  { name: "Energy",       key: "kcal", tkey: "kcal", unit: "kcal" },
  { name: "Protein",      key: "p",    tkey: "p",    unit: "g" },
  { name: "Carbohydrate", key: "c",    tkey: "c",    unit: "g" },
  { name: "Fat",          key: "fat",  tkey: "fat",  unit: "g" },
  { name: "Fibre",        key: "fi",   tkey: "fi",   unit: "g" },
];
const MORE_ROWS: Row[] = [
  { name: "Iron",      key: "fe",  tkey: "fe",  unit: "mg" },
  { name: "Calcium",   key: "ca",  tkey: "ca",  unit: "mg" },
  { name: "Vitamin B12", key: "b12", tkey: "b12", unit: "µg" },
  { name: "Potassium", key: "k",   tkey: "k",   unit: "mg" },
  { name: "Sodium",    key: "na",  tkey: "na",  unit: "mg", limit: true },
];
const num = (x: number, unit: string) => (x >= 100 || unit === "kcal" ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString("en-IN");
const fmtQ = (x: number, unit: string) => `${num(x, unit)} ${unit}`;

export const INK = "#241238";
export const PLUM = "#3B1F5C";
export const MUTED = "#5F5473";

export default function WhatsForToday({
  logs: serverLogs, suggestions, dailyKcalGoal, targets, day, today, tomorrow, isPrime, festivalTab, quickPicks, quickLabel, plans: serverPlans, poolNames, memberNames, userId, kutumbhId,
}: Props) {
  const tz = useFamilyTimeZone();
  const router = useRouter();
  const supabase = createClient();

  // A tap shows at once; the server catches up in the background
  const [logs, setLogs] = useState<Log[]>(serverLogs);
  useEffect(() => setLogs(serverLogs), [serverLogs]);

  // The menu shows a tick at once; the page catches up in the background
  const [plans, setPlans] = useState<Plan[]>(serverPlans);
  useEffect(() => setPlans(serverPlans), [serverPlans]);
  // The festival menu starts open on a festival day, so it is the first thing seen

  const [open, setOpen]         = useState<Record<string, boolean>>({});
  const [editing, setEditing]   = useState<Record<string, boolean>>({});
  const [seeMore, setSeeMore]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [pending, setPending]   = useState<Set<string>>(new Set());
  const [error, setError]       = useState<string | null>(null);
  const [undo, setUndo]         = useState<{ ids: string[]; text: string } | null>(null);

  const canLog = day <= today;
  const version = plans.map((p) => p.id).join("-") || "empty";

  const slotPlans = (slot: string) => plans.filter((p) => p.meal_slot === slot);
  const slotLogs  = (slot: string) => logs.filter((l) => l.meal_slot === slot);
  const logFor    = (slot: string, p: Plan) => slotLogs(slot).find((l) => same(p, l));
  const nOf       = (l: Log) => (l.n ? scaled(l.n, timesOf(l)) : null);

  function toLog(p: Plan, slot: string) {
    return {
      user_id: userId, food_item_id: p.food_item_id, food_name: p.food_name, meal_slot: slot,
      quantity_g: defQty(p.serving_unit), quantity_unit: p.serving_unit ?? "serving", calories: p.kcal_per_serving, logged_date: day,
    };
  }

  async function insertRows(rows: ReturnType<typeof toLog>[], ns: (Nutr | null)[], slot: string, recipeIds: (number | null | undefined)[]) {
    const { data, error: err } = await supabase.from("meal_logs").insert(rows).select("id");
    if (err || !data) { setError("Could not log this. Please try again."); return null; }
    const ids = data.map((r) => r.id as string);
    setLogs((cur) => [...cur, ...rows.map((r, i) => ({
      id: ids[i], food_item_id: r.food_item_id, food_name: r.food_name, meal_slot: slot,
      quantity_g: r.quantity_g, quantity_unit: r.quantity_unit, calories: r.calories,
      nutrition_estimated: false, recipe_id: recipeIds[i] ?? null, n: ns[i],
    }))]);
    return ids;
  }

  // A tick shows at once; the database and the page catch up in the background.
  // Only this dish waits for its own answer, so the next tap never has to.
  async function tapDish(slot: string, p: Plan) {
    const k = `${slot}:${p.id}`;
    if (!canLog || pending.has(k)) return;
    setPending((s) => new Set(s).add(k));
    setError(null); setUndo(null);
    const done = () => setPending((s) => { const n = new Set(s); n.delete(k); return n; });
    const have = logFor(slot, p);
    if (have) {
      setLogs((cur) => cur.filter((l) => l.id !== have.id));
      const { error: err } = await supabase.from("meal_logs").delete().eq("id", have.id);
      if (err) { setLogs((cur) => [...cur, have]); setError("Could not take this off. Please try again."); }
    } else {
      const row = toLog(p, slot);
      const tmp = `tmp-${Date.now()}-${p.id}`;
      setLogs((cur) => [...cur, {
        id: tmp, food_item_id: row.food_item_id, food_name: row.food_name, meal_slot: slot,
        quantity_g: row.quantity_g, quantity_unit: row.quantity_unit, calories: row.calories,
        nutrition_estimated: false, recipe_id: p.recipe_id ?? null, n: p.n,
      }]);
      const { data, error: err } = await supabase.from("meal_logs").insert(row).select("id").single();
      if (err || !data) { setLogs((cur) => cur.filter((l) => l.id !== tmp)); setError("Could not log this. Please try again."); }
      else setLogs((cur) => cur.map((l) => (l.id === tmp ? { ...l, id: data.id as string } : l)));
    }
    done();
    startTransition(() => router.refresh());
  }

  // How much was eaten: change the quantity and the values follow
  async function setQty(l: Log, dir: 1 | -1) {
    if (busy || l.id.startsWith("tmp-")) return;
    const step = stepOf(l.quantity_unit);
    const old = Number(l.quantity_g) || defQty(l.quantity_unit);
    const next = Math.max(step, Math.round((old + dir * step) * 10) / 10);
    if (next === old) return;
    const kcal = l.calories != null && old > 0 ? Math.round((Number(l.calories) * next) / old) : null;
    setLogs((cur) => cur.map((x) => (x.id === l.id ? { ...x, quantity_g: next, calories: kcal } : x)));
    const { error: err } = await supabase.from("meal_logs").update({ quantity_g: next, calories: kcal }).eq("id", l.id);
    if (err) {
      setLogs((cur) => cur.map((x) => (x.id === l.id ? l : x)));
      setError("Could not change the quantity. Please try again.");
    } else router.refresh();
  }

  function Qty({ l }: { l: Log }) {
    const q = Number(l.quantity_g) || defQty(l.quantity_unit);
    const btn = "w-11 h-11 rounded-full text-lg font-bold flex items-center justify-center";
    return (
      <div className="flex items-center justify-between gap-2 px-1 pt-1" role="group" aria-label={`Quantity of ${l.food_name}`}>
        <span className="text-xs" style={{ color: MUTED }}>How much?</span>
        <span className="flex items-center gap-2">
          <button onClick={() => setQty(l, -1)} className={btn} style={{ background: "#fff", border: `1.5px solid ${PLUM}`, color: PLUM }} aria-label="Less">−</button>
          <span className="text-sm font-bold min-w-[84px] text-center tabular-nums" style={{ color: INK }}>
            {qtyText(q, l.quantity_unit)}
            {l.calories != null && <span className="block text-[11px] font-normal" style={{ color: MUTED }}>{Math.round(Number(l.calories))} kcal</span>}
          </span>
          <button onClick={() => setQty(l, 1)} className={btn} style={{ background: "#fff", border: `1.5px solid ${PLUM}`, color: PLUM }} aria-label="More">+</button>
        </span>
      </div>
    );
  }

  async function logAll(slot: string) {
    if (!canLog || busy) return;
    const todo = slotPlans(slot).filter((p) => !logFor(slot, p));
    if (!todo.length) return;
    setBusy(true); setError(null);
    const ids = await insertRows(todo.map((p) => toLog(p, slot)), todo.map((p) => p.n), slot, todo.map((p) => p.recipe_id));
    setBusy(false);
    if (ids) {
      setUndo({ ids, text: `Logged ${todo.length} ${todo.length === 1 ? "dish" : "dishes"}.` });
      setTimeout(() => setUndo((u) => (u && u.ids === ids ? null : u)), 8000);
      router.refresh();
    }
  }

  async function logSuggestion(slot: string, s: MealSuggestion) {
    if (!canLog || busy) return;
    setBusy(true); setError(null);
    const rows = s.items.map((it) => ({
      user_id: userId, food_item_id: it.food_item_id, food_name: it.food_name, meal_slot: slot,
      quantity_g: it.quantity_g ?? 1, quantity_unit: it.quantity_unit ?? "serving", calories: it.calories, logged_date: day,
    }));
    const ids = await insertRows(rows, rows.map(() => null), slot, rows.map(() => null));
    setBusy(false);
    if (ids) {
      setUndo({ ids, text: "Logged." });
      setTimeout(() => setUndo((u) => (u && u.ids === ids ? null : u)), 8000);
      router.refresh();
    }
  }

  async function undoLog() {
    if (!undo) return;
    const { error: err } = await supabase.from("meal_logs").delete().in("id", undo.ids);
    if (err) { setError("Could not undo. Tap the dish to take it off."); return; }
    setLogs((cur) => cur.filter((l) => !undo.ids.includes(l.id)));
    setUndo(null);
    router.refresh();
  }

  // ── Food values: preloaded from the menu, like the dishes themselves. A
  // meal counts what you logged once you have logged anything in it; until
  // then it counts what the menu holds (marked ~). Worked out afresh after
  // every tap or menu edit.
  const eatenOf = (slot: string) => sum(slotLogs(slot).flatMap((l) => { const n = nOf(l); return n ? [n] : []; }));
  const plannedOf = (slot: string) => sum(slotPlans(slot).flatMap((p) => (p.n ? [p.n] : [])));
  const fromMenu = (slot: string) => !canLog || slotLogs(slot).length === 0;
  const valueOf = (slot: string) => (fromMenu(slot) ? plannedOf(slot) : eatenOf(slot));
  const projected = (slot: string) => canLog && slotLogs(slot).length === 0 && slotPlans(slot).length > 0;
  const anyProjected = SLOTS.some((s) => projected(s.key));
  const dayTotal = sum(SLOTS.map((s) => valueOf(s.key)));
  const noValues = SLOTS.reduce((t, s) => t + (fromMenu(s.key)
    ? slotPlans(s.key).filter((p) => !p.n).length
    : slotLogs(s.key).filter((l) => !l.n).length), 0);
  const anything = logs.length > 0 || plans.length > 0;
  const projectedDay = SLOTS.some((s) => projected(s.key));

  const tabBase = "px-3 text-sm min-h-[44px] self-end border-b-[3px] whitespace-nowrap";
  const isToday = day === today;
  const isTomorrow = day === tomorrow;

  return (
    <div className="flex flex-col gap-3">
     {/* Intake This Week: today in the middle, three days either side. The chosen day drives everything below. */}
     <div className="rounded-2xl px-2 py-2" style={{ background: "#fff", border: `2.5px solid ${FAMILY.violet.edge}` }} role="navigation" aria-label="Intake this week">
        <p className="m-0 mb-1.5 px-1 text-sm font-bold" style={{ color: PLUM }}>Intake This Week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(today, i - 3);
            const on = date === day;
            const isNow = date === today;
            const ahead = date > today;
            const wd = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short" });
            const dd = new Date(`${date}T00:00:00Z`).getUTCDate();
            return (
              <Link key={date} href={isNow ? "/dashboard" : `/dashboard?date=${date}`} aria-current={on ? "page" : undefined}
                aria-label={`${isNow ? "Today, " : ""}${wd} ${dd}`}
                className="rounded-xl text-center leading-tight min-w-0 flex flex-col items-center justify-center"
                style={{ minHeight: 56, background: on ? PLUM : ahead ? "#F3EEFA" : "#fff", color: on ? "#fff" : INK,
                         border: `${on ? 2 : 1.5}px ${ahead && !on ? "dashed" : "solid"} ${on ? PLUM : "#C9BEDD"}` }}>
                <span className="block text-[10px]" style={{ color: on ? "#F5B82E" : MUTED, fontWeight: isNow ? 800 : 400 }}>{isNow ? "TODAY" : wd}</span>
                <span className="block text-base font-bold">{dd}</span>
              </Link>
            );
          })}
        </div>
        {(day < addDays(today, -3) || day > addDays(today, 3)) && (
          <p className="m-0 mt-1.5 px-1 text-xs" style={{ color: MUTED }}>
            Showing {dayLabel(day, tz)} · <Link href="/dashboard" className="font-semibold underline" style={{ color: "#6B46B8" }}>back to today</Link>
          </p>
        )}
        {festivalTab && <p className="m-0 mt-1.5 px-1 text-xs" style={{ color: MUTED }}>🪔 {festivalTab}</p>}
      </div>

      {/* Food values of the chosen day: what was eaten against the member's own range */}
      <div className="rounded-2xl px-3 py-3 flex flex-col gap-2" style={{ background: WARM.bg, border: `2.5px solid ${WARM.edge}` }} aria-live="polite">
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 text-sm font-bold" style={{ color: INK }}>
            Food Values · {isToday ? "Today" : isTomorrow ? "Tomorrow" : new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short" })}
          </p>
          <p className="m-0 text-xs" style={{ color: MUTED }}>{new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}</p>
        </div>
        <table className="w-full text-[13px]" style={{ color: INK, borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-[11px]" style={{ color: MUTED, borderBottom: `1.5px solid ${WARM.edge}` }}>
              <th className="py-1 font-bold">Particulars</th>
              <th className="py-1 font-bold text-right">Qty</th>
              <th className="py-1 font-bold text-right">Good Range</th>
              <th className="py-1 font-bold text-right">Intake %</th>
            </tr>
          </thead>
          <tbody>
            {(seeMore ? [...VALUE_ROWS, ...MORE_ROWS] : VALUE_ROWS).map((row, i, all) => {
              const have = dayTotal[row.key];
              const t = targets[row.tkey];
              const lo = row.limit ? t : t * 0.95;
              const hi = row.limit ? t : t * 1.05;
              const pct = lo > 0 ? Math.round((have / lo) * 100) : 0;
              return (
                <tr key={row.name} style={{ borderBottom: i < all.length - 1 ? "1px solid rgba(194,85,31,0.25)" : undefined }}>
                  <td className="py-2 font-bold">{row.name}</td>
                  <td className="py-2 text-right tabular-nums" style={projectedDay ? { opacity: 0.7 } : undefined}>{projectedDay ? "~" : ""}{fmtQ(have, row.unit)}</td>
                  <td className="py-2 text-right tabular-nums">{row.limit ? `up to ${fmtQ(t, row.unit)}` : `${num(lo, row.unit)}–${fmtQ(hi, row.unit)}`}</td>
                  <td className="py-2 text-right font-extrabold tabular-nums">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={() => setSeeMore((v) => !v)} aria-expanded={seeMore}
          className="w-full rounded-xl text-sm font-bold" style={{ minHeight: 44, background: "#fff", border: `1.5px solid ${WARM.edge}`, color: "#8A3A12" }}>
          {seeMore ? "See less ▴" : "See more ▾"}
        </button>
        {!anything && <p className="m-0 text-[11px]" style={{ color: MUTED }}>{canLog ? "Plan or log a dish to see values" : "Add dishes to see values"}</p>}
        <p className="m-0 text-[11px]" style={{ color: MUTED }}>
          Good Range is from your profile; Intake % is against its lower number.{anyProjected ? " ~ From the menu · your log replaces it." : ""}
          {noValues > 0 ? ` ${noValues} ${noValues === 1 ? "dish" : "dishes"} without values · excluded.` : ""} Estimates · IFCT-based
        </p>
      </div>

      {SLOTS.map(({ key, label, icon, time }) => {
        const ps = slotPlans(key);
        const ls = slotLogs(key);
        const isOpen = !!open[key];
        const kcalHere = Math.round(valueOf(key).kcal);
        const extra = ls.filter((l) => !ps.some((p) => same(p, l)));
        const sug = suggestions.find((x) => x.meal_slot === key);
        // The dishes in one line, so a closed card says what is cooking
        const names = ps.length ? ps.map((p) => p.food_name) : ls.map((l) => l.food_name);
        const dishLine = names.join(", ");
        const tot = valueOf(key);

        return (
          <div key={key} className="rounded-2xl overflow-hidden" style={{ background: COOL.bg, border: `2.5px solid ${COOL.edge}` }}>
            <button onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} aria-expanded={isOpen}
              className="w-full flex flex-col px-3 pt-2 pb-2.5 text-left"
              style={{ minHeight: 60, background: isOpen ? COOL.open : COOL.bg }}>
              <span className="flex items-center justify-between gap-2 w-full">
                <span className="text-sm font-bold" style={{ color: INK }}>{label}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: INK }}>
                    {canLog
                      ? (ls.length && Math.round(tot.kcal) ? `${Math.round(tot.kcal)} kcal` : "Not logged")
                      : (Math.round(tot.kcal) ? `~${Math.round(tot.kcal)} kcal` : "Not planned")}
                  </span>
                  <span aria-hidden style={{ color: PLUM, display: "inline-block", transform: isOpen ? "rotate(180deg)" : undefined }}>⌄</span>
                </span>
              </span>
              <span className="text-sm leading-5" style={{ color: INK }}>{dishLine || "Not planned yet"}</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
                {!isPrime && ps.length === 0 && ls.length === 0 && (
                  <p className="text-sm italic py-1" style={{ color: MUTED }}>The Key Member has not planned this meal yet.</p>
                )}

                {!(isPrime && editing[key]) && canLog && ps.length > 1 && ps.some((p) => !logFor(key, p)) && (
                  <button onClick={() => logAll(key)} disabled={busy}
                    className="self-start px-4 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: INK, minHeight: 44 }}>
                    Log all as planned
                  </button>
                )}

                {!(isPrime && editing[key]) && ps.map((p) => {
                  const on = !!logFor(key, p);
                  const body = (
                    <>
                      <span className="flex flex-col min-w-0 text-left">
                        <span className="text-sm" style={{ color: INK }}>{p.food_name}</span>
                        <span className="text-xs" style={{ color: MUTED }}>
                          {p.kcal_per_serving != null ? `${p.kcal_per_serving} kcal / ${p.serving_unit === "g" ? "100 g" : (p.serving_unit ?? "serving")}` : "No values yet"}
                        </span>
                      </span>
                      {p.recipe_id != null && (
                        <Link href={`/recipes/${p.recipe_id}`} className="text-[11px] font-semibold ml-auto px-1 flex-shrink-0" style={{ color: "#6B46B8" }}
                          onClick={(e) => e.stopPropagation()}>📖 Recipe</Link>
                      )}
                    </>
                  );
                  const lg = logFor(key, p);
                  return canLog ? (
                    <div key={p.id} className="rounded-xl" style={{ border: `2px solid ${on ? PLUM : FAMILY.blue.edge}`, background: on ? "#EDE4F8" : "#fff" }}>
                      <button onClick={() => tapDish(key, p)} aria-pressed={on} disabled={busy}
                        className="flex items-center gap-3 w-full px-2.5" style={{ minHeight: 52 }}>
                        <span className="w-[26px] h-[26px] rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm"
                          style={{ background: on ? PLUM : "#fff", border: `2px solid ${on ? PLUM : "#8D7FA6"}` }}>{on ? "✓" : ""}</span>
                        {body}
                      </button>
                      {lg && <div className="px-2.5 pb-2"><Qty l={lg} /></div>}
                    </div>
                  ) : (
                    <div key={p.id} className="flex items-center gap-3 px-1" style={{ minHeight: 40 }}>{body}</div>
                  );
                })}

                {extra.map((l) => (
                  <div key={l.id} className="rounded-xl pb-2" style={look(FAMILY.green)}>
                    <div className="flex items-center justify-between gap-2 px-2.5" style={{ minHeight: 44 }}>
                      <span className="text-sm" style={{ color: INK }}>{l.food_name} <span className="text-xs" style={{ color: MUTED }}>· logged by you</span></span>
                      <button onClick={async () => {
                        const { error: err } = await supabase.from("meal_logs").delete().eq("id", l.id);
                        if (err) setError("Could not take this off."); else { setLogs((c) => c.filter((x) => x.id !== l.id)); router.refresh(); }
                      }} className="text-xs font-semibold underline px-2" style={{ color: PLUM, minHeight: 44 }}>Remove</button>
                    </div>
                    <div className="px-2.5"><Qty l={l} /></div>
                  </div>
                ))}

                {canLog && ps.length === 0 && ls.length === 0 && sug && sug.items.length > 0 && (
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={look(FAMILY.violet)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold" style={{ color: "#6B46B8" }}>{whyText(sug)}</p>
                      <p className="text-sm truncate" style={{ color: INK }}>{sug.items.map((i) => i.food_name).join(", ")}</p>
                    </div>
                    <button onClick={() => logSuggestion(key, sug)} disabled={busy}
                      className="flex-shrink-0 px-4 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: INK, minHeight: 44 }}>Log</button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {isPrime && (
                    <button onClick={() => setEditing((e) => ({ ...e, [key]: !e[key] }))}
                      className="px-4 rounded-full text-sm font-bold"
                      style={{ minHeight: 44, border: `1.5px solid ${PLUM}`, color: PLUM, background: "#fff" }}>
                      {editing[key] ? "Done" : (ps.length ? "Change menu" : "Add dishes")}
                    </button>
                  )}
                  {canLog && (
                    <Link href={`/log?slot=${key}&date=${day}`} className="px-3 text-xs font-semibold underline flex items-center"
                      style={{ minHeight: 44, color: "#6B46B8" }}>
                      Log something else
                    </Link>
                  )}
                </div>

                {isPrime && editing[key] && (
                  <PlanSlotCard key={`${key}-${version}`} slotKey={key} name={label} icon={icon} time={time}
                    userId={userId} kutumbhId={kutumbhId} plannedDate={day}
                    embedded quickPicks={quickPicks[key]} quickLabel={quickLabel} initialItems={ps} initialPoolName={poolNames[key] ?? null} memberNames={memberNames} />
                )}

              </div>
            )}
          </div>
        );
      })}

      {error && <p className="px-3 py-2 text-xs" style={{ color: "#B42318" }}>{error}</p>}
      {undo && (
        <div className="px-3 flex items-center justify-between text-sm" style={{ ...look(FAMILY.violet), color: PLUM }}>
          <span>{undo.text}</span>
          <button onClick={undoLog} className="font-bold underline px-3" style={{ minHeight: 44 }}>Undo</button>
        </div>
      )}

    </div>
  );
}

export function Values({ title, color, cells, dark }: { title: string; color: string; cells: { label: string; value: string }[]; dark?: boolean }) {
  return (
    <div>
      {title && <p className="text-[11px] font-bold mb-1" style={{ color }}>{title}</p>}
      <div className="grid grid-cols-5 gap-1">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col items-center text-center min-w-0">
            <span className="text-sm font-bold leading-[18px]" style={{ color: dark ? "#fff" : INK }}>{c.value}</span>
            <span className="text-[10px] leading-3" style={{ color: dark ? color : MUTED }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}