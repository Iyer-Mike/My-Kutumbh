"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FAMILY } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import { announceMenu } from "@/lib/menu-notify";
import { slotLabel } from "@/lib/meal-slots";
import { dayLabel } from "@/lib/dates";
import Legend from "@/components/Legend";

type Slot = { date: string; slot: string; why: string; dishes: { id: string; name: string; unit: string }[] };
type Average = { id: string; name: string; kcal: number; kcalPct: number; protein: number; proteinPct: number; status: "good" | "watch" | "off" };
type Result = {
  summary: string; window: { from: string; to: string }; keptCount: number; needs: string[]; slots: Slot[]; averages: Average[];
};

const STEPS = ["Choose", "Review", "Publish"] as const;
const TONE = { good: FAMILY.green, watch: FAMILY.gold, off: FAMILY.red } as const;
const TONE_WORD = { good: "On track", watch: "A little off", off: "Well off" } as const;

/**
 * Key Member only: the planner proposes the next seven days, nothing reaches
 * the family until "Use this menu". Empty meals only; anything already planned stays.
 */
export default function SuggestMenu({ kutumbhId, userId, timeZone }: { kutumbhId: string; userId: string; timeZone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const step = done ? 2 : res ? 1 : 0;

  async function ask() {
    setBusy(true); setError(null); setDone(null);
    try {
      const r = await fetch("/api/suggest-menu", { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error ?? "Couldn't plan the week."); return; }
      setRes(data as Result);
    } catch {
      setError("No connection. Please try again.");
    } finally { setBusy(false); }
  }

  async function use() {
    if (!res || busy) return;
    setBusy(true); setError(null);
    try {
      const supabase = createClient();
      // Meals someone filled since the proposal stay as they are
      const { data: now } = await supabase.from("meal_plans").select("planned_date, meal_slot")
        .eq("kutumbh_id", kutumbhId).gte("planned_date", res.window.from).lte("planned_date", res.window.to);
      const taken = new Set((now ?? []).map((p) => `${p.planned_date}|${p.meal_slot}`));
      const fresh = res.slots.filter((s) => !taken.has(`${s.date}|${s.slot}`));
      const rows = fresh.flatMap((s) => s.dishes.map((d) => ({
        user_id: userId, kutumbh_id: kutumbhId, planned_date: s.date, meal_slot: s.slot,
        food_name: d.name, quantity_g: 1, quantity_unit: d.unit, food_item_id: d.id,
      })));
      if (!rows.length) { setError("Those meals have all been planned in the meantime."); return; }
      const { error: e } = await supabase.from("meal_plans").insert(rows);
      if (e) { setError(`Couldn't save the menu: ${e.message}`); return; }
      const byDate = new Map<string, string[]>();
      for (const s of fresh) byDate.set(s.date, [...(byDate.get(s.date) ?? []), `${slotLabel(s.slot)}: added ${s.dishes.map((d) => d.name).join(", ")}`]);
      for (const [date, lines] of byDate) announceMenu(kutumbhId, date, lines);
      setDone(`Published ${fresh.length} meal${fresh.length === 1 ? "" : "s"}. The family can see the menu now.`);
      router.refresh();
    } finally { setBusy(false); }
  }

  function close() { setOpen(false); setRes(null); setDone(null); setError(null); }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl px-4 py-3 mb-4 text-left flex items-center justify-between gap-3 min-h-11"
        style={{ background: "#EDE7F7", border: "1.5px solid #6B46B8" }}>
        <span>
          <span className="block text-sm font-bold" style={{ color: "#4B2E8A" }}>Suggest the next 7 days&apos; menu</span>
          <span className="block text-xs" style={{ color: "#6A6180" }}>Fills only the empty meals · you review it before anyone sees it</span>
        </span>
        <span aria-hidden className="text-lg">✨</span>
      </button>
    );
  }

  const days = res ? [...new Set(res.slots.map((s) => s.date))].sort() : [];
  return (
    <section className="rounded-2xl px-4 py-3 mb-4 grid gap-3" style={{ background: "#fff", border: "2px solid #6B46B8" }} aria-label="Suggest the menu">
      <div className="flex items-center justify-between gap-2">
        <ol className="m-0 p-0 list-none flex items-center gap-1.5 text-[11px] font-semibold">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full" style={i === step ? { background: "#6B46B8", color: "#fff" } : { background: "#EDE7F7", color: "#6A6180" }}>{i + 1}. {s}</span>
              {i < STEPS.length - 1 && <span aria-hidden style={{ color: "#6A6180" }}>›</span>}
            </li>
          ))}
        </ol>
        <button onClick={close} className="text-xs underline" style={{ color: "#6A6180" }}>Close</button>
      </div>

      {!res && !done && (
        <div className="grid gap-2">
          <p className="m-0 text-sm" style={{ color: "#241C33" }}>
            The planner chooses dishes for the next seven days around your profile. Every member&apos;s allergies are kept out. Where a member has a medical report, their dietary needs are taken into account too. Meals already planned are left alone.
          </p>
          <button onClick={ask} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white min-h-11 disabled:opacity-60" style={{ background: "#6B46B8" }}>
            {busy ? "Planning the week…" : "Plan the week"}
          </button>
        </div>
      )}

      {res && !done && (
        <>
          <p className="m-0 text-sm" style={{ color: "#241C33" }}>{res.summary}</p>
          {res.needs.length > 0 && (
            <p className="m-0 text-xs rounded-lg px-3 py-2" style={{ background: FAMILY.gold.bg, border: `1.5px solid ${FAMILY.gold.edge}`, color: FAMILY.gold.ink }}>
              Also planned around dietary needs on file: {res.needs.join(" · ")}. Medical readings are not shown here.
            </p>
          )}

          <div className="grid gap-1.5">
            <p className="m-0 text-xs font-bold uppercase tracking-wide" style={{ color: "#6B46B8" }}>Weekly average per person · against own Good Range</p>
            {res.averages.map((a) => {
              const t = TONE[a.status];
              return (
                <div key={a.id} className="rounded-lg px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5" style={{ background: t.bg, border: `2px solid ${t.edge}`, color: t.ink }}>
                  <span className="font-bold">{a.name}</span>
                  <span>{a.kcal} kcal ({a.kcalPct}%) · {a.protein} g protein ({a.proteinPct}%)</span>
                  <span className="text-xs font-semibold">{TONE_WORD[a.status]}</span>
                </div>
              );
            })}
            <Legend title="Weekly average" entries={[
              { colour: FAMILY.green.bg, edge: FAMILY.green.edge, label: "Within 15% of the Good Range" },
              { colour: FAMILY.gold.bg, edge: FAMILY.gold.edge, label: "15–30% away" },
              { colour: FAMILY.red.bg, edge: FAMILY.red.edge, label: "More than 30% away" },
            ]} />
            <p className="m-0 text-[11px]" style={{ color: "#6A6180" }}>Counts one serving of every planned dish per person, over seven days{res.keptCount ? `, including the ${res.keptCount} meals already planned` : ""}. Real portions will differ.</p>
          </div>

          <div className="grid gap-2">
            {days.map((date) => (
              <div key={date} className="rounded-xl px-3 py-2" style={{ background: FAMILY.blue.bg, border: `2px solid ${FAMILY.blue.edge}` }}>
                <p className="m-0 text-xs font-bold" style={{ color: FAMILY.blue.ink }}>{dayLabel(date, timeZone)}</p>
                <ul className="m-0 mt-1 p-0 list-none grid gap-1">
                  {res.slots.filter((s) => s.date === date).map((s) => (
                    <li key={s.slot} className="text-sm" style={{ color: "#241C33" }}>
                      <span className="font-semibold">{slotLabel(s.slot)}:</span> {s.dishes.map((d) => d.name).join(", ")}
                      <span className="block text-xs" style={{ color: "#6A6180" }}>{s.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={use} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white min-h-11 disabled:opacity-60" style={{ background: "#2E8B57" }}>
              {busy ? "Saving…" : "Use this menu"}
            </button>
            <button onClick={ask} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold min-h-11 disabled:opacity-60" style={{ border: "2px solid #6B46B8", color: "#4B2E8A" }}>
              Ask again
            </button>
            <button onClick={() => { setRes(null); setError(null); }} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm min-h-11" style={{ color: "#6A6180" }}>
              Discard
            </button>
          </div>
          <p className="m-0 text-[11px]" style={{ color: "#6A6180" }}>Everyone in the family sees the menu once you use it. Each meal can still be changed from the Plan.</p>
        </>
      )}

      {done && (
        <div className="grid gap-2">
          <p className="m-0 text-sm font-semibold" style={{ color: FAMILY.green.ink }}>{done}</p>
          <button onClick={close} className="rounded-xl px-4 py-2.5 text-sm font-semibold min-h-11" style={{ border: "2px solid #6B46B8", color: "#4B2E8A" }}>Done</button>
        </div>
      )}

      {error && <p role="alert" className="m-0 text-sm font-semibold" style={{ color: FAMILY.red.ink }}>{error}</p>}
    </section>
  );
}
