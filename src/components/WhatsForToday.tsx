"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SLOTS } from "@/lib/meal-slots";
import { dayLabel } from "@/lib/dates";
import { useFamilyTimeZone } from "@/lib/family-time";
import { microCells, nutrientCells, scaled, sum, type Nutr } from "@/lib/serving-nutrition";
import PlanSlotCard, { type PlanItem } from "./PlanSlotCard";

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
  day: string;
  today: string;
  tomorrow: string;
  isPrime: boolean;
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

const same = (p: Plan, l: Log) =>
  p.food_item_id && l.food_item_id ? p.food_item_id === l.food_item_id : p.food_name.toLowerCase() === l.food_name.toLowerCase();

const INK = "#241238";
const PLUM = "#3B1F5C";
const MUTED = "#5F5473";

export default function WhatsForToday({
  logs: serverLogs, suggestions, dailyKcalGoal, day, today, tomorrow, isPrime, plans, poolNames, memberNames, userId, kutumbhId,
}: Props) {
  const tz = useFamilyTimeZone();
  const router = useRouter();
  const supabase = createClient();

  // A tap shows at once; the server catches up in the background
  const [logs, setLogs] = useState<Log[]>(serverLogs);
  useEffect(() => setLogs(serverLogs), [serverLogs]);

  const [open, setOpen]         = useState<Record<string, boolean>>({});
  const [editing, setEditing]   = useState<Record<string, boolean>>({});
  const [estimated, setEst]     = useState<Record<string, string>>({});
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [undo, setUndo]         = useState<{ ids: string[]; text: string } | null>(null);

  const canLog = day <= today;
  const version = plans.map((p) => p.id).join("-") || "empty";

  const slotPlans = (slot: string) => plans.filter((p) => p.meal_slot === slot);
  const slotLogs  = (slot: string) => logs.filter((l) => l.meal_slot === slot);
  const logFor    = (slot: string, p: Plan) => slotLogs(slot).find((l) => same(p, l));
  const nOf       = (l: Log) => (l.n ? scaled(l.n, Number(l.quantity_g) || 1) : null);
  // The key changes whenever what was eaten in a meal changes, which is
  // when its estimate stops being true
  const sig = (slot: string) => slotLogs(slot).map((l) => l.id).sort().join(",");

  function toLog(p: Plan, slot: string) {
    return {
      user_id: userId, food_item_id: p.food_item_id, food_name: p.food_name, meal_slot: slot,
      quantity_g: 1, quantity_unit: p.serving_unit ?? "serving", calories: p.kcal_per_serving, logged_date: day,
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

  // ── Estimates ──────────────────────────────────────────────────────────
  const marked  = SLOTS.filter((s) => slotLogs(s.key).length > 0);
  const pending = marked.filter((s) => estimated[s.key] !== sig(s.key));
  const isDone  = (key: string) =>
    (slotPlans(key).length === 0 && slotLogs(key).length === 0) || (slotLogs(key).length > 0 && estimated[key] === sig(key));
  const dayDone = canLog && marked.length > 0 && SLOTS.every((s) => isDone(s.key));

  function estimate() {
    const next = { ...estimated };
    for (const s of marked) next[s.key] = sig(s.key);
    setEst(next);
    setOpen((o) => { const m = { ...o }; for (const s of marked) m[s.key] = true; return m; });
  }

  const allEaten = logs.flatMap((l) => { const n = nOf(l); return n ? [n] : []; });
  const dayTotal = sum(allEaten);
  const noValues = logs.filter((l) => !l.n).length;

  const tabBase = "px-3 text-sm min-h-[44px] self-end border-b-[3px] whitespace-nowrap";
  const isToday = day === today;
  const isTomorrow = day === tomorrow;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E4DBF0" }}>
      {/* Title bar */}
      <div className="flex items-stretch gap-0.5 px-1.5 overflow-x-auto" style={{ background: PLUM, height: 48 }}>
        <Link href="/dashboard" aria-current={isToday ? "page" : undefined} className={tabBase}
          style={{ display: "flex", alignItems: "center", borderColor: isToday ? "#F5B82E" : "transparent",
                   color: isToday ? "#fff" : "#C9B8E4", fontWeight: isToday ? 700 : 500 }}>
          What&apos;s for Today
        </Link>
        <Link href={`/dashboard?date=${tomorrow}`} aria-current={isTomorrow ? "page" : undefined} className={tabBase}
          style={{ display: "flex", alignItems: "center", borderColor: isTomorrow ? "#F5B82E" : "transparent",
                   color: isTomorrow ? "#fff" : "#C9B8E4", fontWeight: isTomorrow ? 700 : 500 }}>
          Tomorrow
        </Link>
        <Link href="/festivals" className={tabBase}
          style={{ display: "flex", alignItems: "center", gap: 4, borderColor: "transparent", color: "#F5B82E", fontWeight: 600 }}>
          <span aria-hidden>🪔</span> Festivals
        </Link>
        {!isToday && !isTomorrow && (
          <span className={tabBase} style={{ display: "flex", alignItems: "center", borderColor: "#F5B82E", color: "#fff", fontWeight: 700 }}>
            {dayLabel(day, tz)}
          </span>
        )}
      </div>
      <p className="px-3 py-2 text-xs leading-4" style={{ background: "#F7F3FC", color: MUTED, borderBottom: "1px solid #E4DBF0" }}>
        {isPrime
          ? "You create the menu here. The family sees the same menu on their Home."
          : "The menu set by your Prime Member. Tap a meal, mark what you ate."}
      </p>

      {SLOTS.map(({ key, label, icon, time }) => {
        const ps = slotPlans(key);
        const ls = slotLogs(key);
        const isOpen = !!open[key];
        const done = estimated[key] === sig(key) && ls.length > 0;
        const eatenHere = sum(ls.flatMap((l) => { const n = nOf(l); return n ? [n] : []; }));
        const missing = ls.filter((l) => !l.n).length;
        const extra = ls.filter((l) => !ps.some((p) => same(p, l)));
        const sug = suggestions.find((x) => x.meal_slot === key);
        const eatenCount = ps.filter((p) => logFor(key, p)).length;
        const summary = ps.length
          ? (canLog && ls.length ? `${eatenCount + extra.length} of ${ps.length + extra.length} eaten` : `${ps.length} ${ps.length === 1 ? "dish" : "dishes"}`)
          : (ls.length ? `${ls.length} logged` : "Not planned yet");

        return (
          <div key={key} style={{ borderBottom: "1px solid #E4DBF0" }}>
            <button onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-2 px-3 text-left"
              style={{ minHeight: 60, background: isOpen ? "#EFE6FA" : "#fff" }}>
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-lg" aria-hidden>{icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-bold" style={{ color: INK }}>{label}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{summary} · {time}</span>
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {done && <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: "#F5B82E", color: INK }}>Estimated</span>}
                <span aria-hidden style={{ color: PLUM, transform: isOpen ? "rotate(180deg)" : undefined }}>⌄</span>
              </span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
                {ps.length === 0 && ls.length === 0 && (
                  <p className="text-sm italic py-1" style={{ color: MUTED }}>
                    {isPrime ? "Nothing here yet. Add the dishes for this meal." : "The Prime Member has not planned this meal yet."}
                  </p>
                )}

                {canLog && ps.length > 1 && ps.some((p) => !logFor(key, p)) && (
                  <button onClick={() => logAll(key)} disabled={busy}
                    className="self-start px-4 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: INK, minHeight: 44 }}>
                    Log all as planned
                  </button>
                )}

                {ps.map((p) => {
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
                  return canLog ? (
                    <button key={p.id} onClick={() => tapDish(key, p)} aria-pressed={on} disabled={busy}
                      className="flex items-center gap-3 w-full px-2.5 rounded-xl"
                      style={{ minHeight: 52, border: `1.5px solid ${on ? PLUM : "#D9CBF0"}`, background: on ? "#EDE4F8" : "#fff" }}>
                      <span className="w-[26px] h-[26px] rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm"
                        style={{ background: on ? PLUM : "#fff", border: `2px solid ${on ? PLUM : "#8D7FA6"}` }}>{on ? "✓" : ""}</span>
                      {body}
                    </button>
                  ) : (
                    <div key={p.id} className="flex items-center gap-3 px-1" style={{ minHeight: 40 }}>{body}</div>
                  );
                })}

                {extra.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 px-2.5 rounded-xl" style={{ minHeight: 44, background: "#F7F3FC" }}>
                    <span className="text-sm" style={{ color: INK }}>{l.food_name} <span className="text-xs" style={{ color: MUTED }}>· logged by you</span></span>
                    <button onClick={async () => {
                      const { error: err } = await supabase.from("meal_logs").delete().eq("id", l.id);
                      if (err) setError("Could not take this off."); else { setLogs((c) => c.filter((x) => x.id !== l.id)); router.refresh(); }
                    }} className="text-xs font-semibold underline px-2" style={{ color: PLUM, minHeight: 44 }}>Remove</button>
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
                    initialItems={ps} initialPoolName={poolNames[key] ?? null} memberNames={memberNames} />
                )}

                {done && (
                  <div className="rounded-xl px-2.5 py-2.5 flex flex-col gap-1.5" style={{ background: "#F7F3FC" }}>
                    <Values title="Nutrients eaten" color={PLUM} cells={nutrientCells(eatenHere)} />
                    <Values title="Micronutrients eaten" color="#8A5A06" cells={microCells(eatenHere)} />
                    {missing > 0 && (
                      <p className="text-[11px]" style={{ color: MUTED }}>
                        {missing} {missing === 1 ? "dish has" : "dishes have"} no food values yet, so {missing === 1 ? "it is" : "they are"} left out.
                      </p>
                    )}
                  </div>
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

      {canLog && (
        <div className="px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: "#FFF6DD" }}>
          <span className="text-xs leading-4" style={{ color: "#5A3E00" }}>
            {dayDone ? "All five meals estimated."
              : marked.length === 0 ? "Tap each meal, mark what was eaten, then estimate."
              : `${marked.length} of 5 meals marked. Day’s Total shows once every meal is estimated.`}
          </span>
          <button onClick={estimate} disabled={pending.length === 0}
            className="flex-shrink-0 px-3.5 rounded-full text-sm font-bold"
            style={{ minHeight: 44, border: 0, background: pending.length ? PLUM : "#E4DBF0", color: pending.length ? "#fff" : "#7D6B9E" }}>
            Estimate Food Values
          </button>
        </div>
      )}

      {dayDone && (
        <div className="px-3 py-3 flex flex-col gap-2" style={{ background: INK }}>
          <p className="text-sm font-bold text-white">Day&apos;s Total</p>
          <Values title="" color="#C9B8E4" dark cells={nutrientCells(dayTotal)} />
          <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            <Values title="" color="#C9B8E4" dark cells={microCells(dayTotal)} />
          </div>
          {dailyKcalGoal ? (
            <p className="text-xs" style={{ color: "#C9B8E4" }}>
              {dayTotal.kcal >= dailyKcalGoal
                ? `${Math.round(dayTotal.kcal - dailyKcalGoal)} kcal over your ${dailyKcalGoal} kcal goal`
                : `${Math.round(dailyKcalGoal - dayTotal.kcal)} kcal under your ${dailyKcalGoal} kcal goal`}
            </p>
          ) : null}
          {noValues > 0 && <p className="text-[11px]" style={{ color: "#C9B8E4" }}>{noValues} logged {noValues === 1 ? "item has" : "items have"} no food values yet and {noValues === 1 ? "is" : "are"} left out.</p>}
          <p className="text-[11px]" style={{ color: "#C9B8E4" }}>Estimates, guided by the Indian Food Composition Tables (IFCT). Approximate.</p>
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
          <div key={c.label} className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-[18px]" style={{ color: dark ? "#fff" : INK }}>{c.value}</span>
            <span className="text-[10px] leading-3" style={{ color: dark ? color : MUTED }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
