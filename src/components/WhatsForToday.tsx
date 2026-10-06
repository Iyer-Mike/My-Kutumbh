"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SLOTS } from "@/lib/meal-slots";
import { dayLabel } from "@/lib/dates";
import { useFamilyTimeZone } from "@/lib/family-time";
import { microCells, nutrientCells, scaled, sum, type Nutr } from "@/lib/serving-nutrition";
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
  targets: { kcal: number; p: number; c: number; fi: number };
  day: string;
  today: string;
  tomorrow: string;
  isPrime: boolean;
  festivalTab: string | null;
  /** Set when a festival day is opened from the Festival days list */
  festivalDayLabel: string | null;
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

// What share of the day's need each meal is meant to carry
const SHARE: Record<string, number> = { breakfast: 0.25, morning_snack: 0.05, lunch: 0.35, evening_snack: 0.10, dinner: 0.25 };
// Two clearly different card families: warm for the day's values, cool for the meals
const WARM = { bg: "#FFE9C7", edge: "#C2551F" };
const COOL = { bg: "#E8F2FD", edge: "#2E64A0", open: "#D3E6FA" };
const BARS = [
  { key: "kcal", name: "Energy",  unit: "kcal", color: "#FF1F8E" },
  { key: "p",    name: "Protein", unit: "g",    color: "#0091FF" },
  { key: "c",    name: "Carbs",   unit: "g",    color: "#FF8F00" },
  { key: "fi",   name: "Fibre",   unit: "g",    color: "#1FD100" },
] as const;

const INK = "#241238";
const PLUM = "#3B1F5C";
const MUTED = "#5F5473";

export default function WhatsForToday({
  logs: serverLogs, suggestions, dailyKcalGoal, targets, day, today, tomorrow, isPrime, festivalTab, festivalDayLabel, quickPicks, quickLabel, plans: serverPlans, poolNames, memberNames, userId, kutumbhId,
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
  const [busy, setBusy]         = useState(false);
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

  async function tapDish(slot: string, p: Plan) {
    if (!canLog || busy) return;
    setBusy(true); setError(null); setUndo(null);
    const have = logFor(slot, p);
    if (have) {
      const { error: err } = await supabase.from("meal_logs").delete().eq("id", have.id);
      if (err) setError("Could not take this off. Please try again.");
      else setLogs((cur) => cur.filter((l) => l.id !== have.id));
    } else {
      await insertRows([toLog(p, slot)], [p.n], slot, [p.recipe_id]);
    }
    setBusy(false);
    router.refresh();
  }

  // How much was eaten: change the quantity and the values follow
  async function setQty(l: Log, dir: 1 | -1) {
    if (busy) return;
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

  const tabBase = "px-3 text-sm min-h-[44px] self-end border-b-[3px] whitespace-nowrap";
  const isToday = day === today;
  const isTomorrow = day === tomorrow;

  return (
    <div className="flex flex-col gap-3">
     <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E4DBF0" }}>
      {/* Title bar */}
      <div className="flex items-stretch gap-0.5 px-1.5" style={{ background: PLUM, height: 48 }}>
        <Link href="/dashboard" aria-current={isToday ? "page" : undefined} className={tabBase}
          style={{ display: "flex", alignItems: "center", borderColor: isToday ? "#F5B82E" : "transparent",
                   color: isToday ? "#fff" : "#C9B8E4", fontWeight: isToday ? 700 : 500 }}>
          {isToday || isTomorrow ? "What\u2019s for Today" : "Today"}
        </Link>
        <Link href={`/dashboard?date=${tomorrow}`} aria-current={isTomorrow ? "page" : undefined} className={tabBase}
          style={{ display: "flex", alignItems: "center", borderColor: isTomorrow ? "#F5B82E" : "transparent",
                   color: isTomorrow ? "#fff" : "#C9B8E4", fontWeight: isTomorrow ? 700 : 500 }}>
          Tomorrow
        </Link>
      </div>
      <p className="px-3 py-2 text-xs leading-4" style={{ background: "#F7F3FC", color: MUTED, borderBottom: "1px solid #E4DBF0" }}>
        {festivalTab ? `🪔 ${festivalTab} · ` : ""}
        {isPrime
          ? "You set the menu · the family sees it"
          : "Menu set by your Key Member · tap a dish to log it"}
      </p>
     </div>

      {festivalDayLabel && (
        <Link href="/festivals" className="inline-flex items-center self-start px-4 rounded-xl text-sm font-semibold"
          style={{ minHeight: 44, background: PLUM, color: "#fff" }}>
          ‹ Festival days · {festivalDayLabel}
        </Link>
      )}

      {/* Food values: first thing under the title bar, right after every log */}
      <div className="rounded-2xl px-3 py-3 flex flex-col gap-2.5" style={{ background: WARM.bg, border: `2.5px solid ${WARM.edge}` }} aria-live="polite">
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 text-sm font-bold" style={{ color: INK }}>{canLog ? "Food values today" : festivalDayLabel ? "Food values of the Festival menu" : "Food values of the menu"}</p>
          <p className="m-0 text-xs" style={{ color: MUTED }}>
            {Math.round(dayTotal.kcal)} kcal{canLog && dailyKcalGoal ? ` of ${dailyKcalGoal}` : ""}
          </p>
        </div>
        {canLog && dailyKcalGoal ? (
          <div className="rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(194,85,31,0.18)" }}>
            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round((dayTotal.kcal / dailyKcalGoal) * 100))}%`, background: dayTotal.kcal >= dailyKcalGoal ? "#B42318" : WARM.edge }} />
          </div>
        ) : null}
        <div className="grid grid-cols-5 gap-1">
          {SLOTS.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center min-w-0">
              <span className="text-sm font-bold leading-[18px]" style={{ color: INK, ...(projected(s.key) ? { opacity: 0.65 } : {}) }}>{Math.round(valueOf(s.key).kcal) ? `${projected(s.key) ? "~" : ""}${Math.round(valueOf(s.key).kcal)}` : "–"}</span>
              <span className="text-[10px] leading-3 truncate" style={{ color: MUTED }}>{s.label.replace(" Snack", " snack")}</span>
            </div>
          ))}
        </div>
        <div className="pt-2" style={{ borderTop: "1px solid rgba(194,85,31,0.30)" }}>
          <Values title="" color={MUTED} cells={nutrientCells(dayTotal)} />
        </div>
        <Values title="" color={MUTED} cells={microCells(dayTotal)} />
        {!anything && <p className="m-0 text-[11px]" style={{ color: MUTED }}>{canLog ? "Plan or log a dish to see values" : "Add dishes to see values"}</p>}
        {anyProjected && <p className="m-0 text-[11px]" style={{ color: MUTED }}>~ From the menu · your log replaces it</p>}
        {noValues > 0 && <p className="m-0 text-[11px]" style={{ color: MUTED }}>{noValues} {noValues === 1 ? "dish" : "dishes"} without values · excluded</p>}
        <p className="m-0 text-[11px]" style={{ color: MUTED }}>Estimates · IFCT-based</p>
      </div>

      {SLOTS.map(({ key, label, icon, time }) => {
        const ps = slotPlans(key);
        const ls = slotLogs(key);
        const isOpen = !!open[key];
        const kcalHere = Math.round(valueOf(key).kcal);
        const extra = ls.filter((l) => !ps.some((p) => same(p, l)));
        const sug = suggestions.find((x) => x.meal_slot === key);
        const eatenCount = ps.filter((p) => logFor(key, p)).length;
        const summary = ps.length
          ? (canLog && ls.length ? `${eatenCount + extra.length} of ${ps.length + extra.length} eaten` : `${ps.length} ${ps.length === 1 ? "dish" : "dishes"}`)
          : (ls.length ? `${ls.length} logged` : "Not planned yet");
        const share = SHARE[key] ?? 0;
        const tot = valueOf(key);
        const needKcal = Math.round(targets.kcal * share);
        const pct = needKcal > 0 ? Math.min(100, Math.round((tot.kcal / needKcal) * 100)) : 0;

        return (
          <div key={key} className="rounded-2xl overflow-hidden" style={{ background: COOL.bg, border: `2.5px solid ${COOL.edge}` }}>
            <button onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-2 px-3 text-left"
              style={{ minHeight: 60, background: isOpen ? COOL.open : COOL.bg }}>
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-lg" aria-hidden>{icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-bold" style={{ color: INK }}>{label} <span className="text-[11px] font-semibold" style={{ color: COOL.edge }}>· {Math.round(share * 100)}% of the day</span></span>
                  <span className="text-xs" style={{ color: MUTED }}>{summary} · {time}</span>
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-bold tabular-nums text-right" style={{ color: INK, ...(projected(key) ? { opacity: 0.7 } : {}) }}>
                  {Math.round(tot.kcal) ? `${projected(key) ? "~" : ""}${Math.round(tot.kcal)}` : "–"}<span className="font-normal" style={{ color: MUTED }}> / {needKcal} kcal</span>
                </span>
                <span aria-hidden style={{ color: PLUM, transform: isOpen ? "rotate(180deg)" : undefined }}>⌄</span>
              </span>
            </button>
            <div className="mx-3 mb-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(46,100,160,0.18)" }} aria-hidden>
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: COOL.edge, opacity: projected(key) ? 0.55 : 1 }} />
            </div>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
                <div className="rounded-xl px-3 py-2 grid gap-1.5" style={{ background: "#fff", border: "1px solid #C9DDF3" }}>
                  <p className="m-0 text-[11px] font-semibold" style={{ color: MUTED }}>Against this meal&apos;s {Math.round(share * 100)}% of the day{projected(key) ? " · ~ from the menu" : ""}</p>
                  {BARS.map((g) => {
                    const need = (g.key === "kcal" ? targets.kcal : g.key === "p" ? targets.p : g.key === "c" ? targets.c : targets.fi) * share;
                    const have = tot[g.key];
                    const f = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 0;
                    return (
                      <div key={g.key} className="flex items-center gap-2 text-[11px]">
                        <span className="w-12 flex-none" style={{ color: MUTED }}>{g.name}</span>
                        <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#E7EEF7" }}>
                          <span className="block h-1.5 rounded-full" style={{ width: `${f}%`, background: g.color }} />
                        </span>
                        <b className="tabular-nums" style={{ color: INK }}>{Math.round(have * 10) / 10}<span className="font-normal" style={{ color: MUTED }}>/{Math.round(need * 10) / 10} {g.unit}</span></b>
                      </div>
                    );
                  })}
                </div>
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
                    <div key={p.id} className="rounded-xl" style={{ border: `1.5px solid ${on ? PLUM : "#D9CBF0"}`, background: on ? "#EDE4F8" : "#fff" }}>
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
                  <div key={l.id} className="rounded-xl pb-2" style={{ background: "#F7F3FC" }}>
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
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#F3ECFC" }}>
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
        <div className="px-3 flex items-center justify-between text-sm" style={{ background: "#F3ECFC", color: PLUM }}>
          <span>{undo.text}</span>
          <button onClick={undoLog} className="font-bold underline px-3" style={{ minHeight: 44 }}>Undo</button>
        </div>
      )}

    </div>
  );
}

function Values({ title, color, cells, dark }: { title: string; color: string; cells: { label: string; value: string }[]; dark?: boolean }) {
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