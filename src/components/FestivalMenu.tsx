"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SLOTS } from "@/lib/meal-slots";
import { microCells, nutrientCells, sum, type Nutr } from "@/lib/serving-nutrition";
import type { StarterItem } from "@/lib/festival-starter";
import PlanSlotCard, { type PlanItem, type QuickPick } from "./PlanSlotCard";
import { COOL, INK, MUTED, PLUM, WARM, Values } from "./WhatsForToday";

type Plan = PlanItem & { meal_slot: string; food_item_id: string | null; n: Nutr | null };
export type Suggestion = {
  id: string; meal_slot: string; food_item_id: string | null; food_name: string;
  note: string | null; suggested_by: string; status: "pending" | "approved" | "declined";
};

type Props = {
  day: string;
  festival: string;           // "Diwali"
  dayLabel: string;           // "Sunday, 8 November"
  daysAway: number;
  isPrime: boolean;
  /** false until the draft/suggestion tables exist: the page then works as a plain menu */
  ready: boolean;
  state: "unset" | "draft" | "published";
  /** the family cannot see a draft */
  hidden: boolean;
  plans: Plan[];
  starter: StarterItem[];
  suggestions: Suggestion[];
  quickPicks: Record<string, QuickPick[]>;
  poolNames: Record<string, string>;
  memberNames: Record<string, string>;
  userId: string;
  kutumbhId: string | null;
};

const kcalOf = (f: { calories: number | null; serving_weight_g: number | null; serving_unit: string | null }) =>
  f.calories == null ? null : Math.round((f.calories * (f.serving_unit === "g" ? 100 : (f.serving_weight_g ?? 100))) / 100);

export default function FestivalMenu(p: Props) {
  const { day, festival, dayLabel, daysAway, isPrime, ready, state, hidden, starter, kutumbhId, userId } = p;
  const supabase = createClient();
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>(p.plans);
  useEffect(() => setPlans(p.plans), [p.plans]);
  const [sugs, setSugs] = useState<Suggestion[]>(p.suggestions);
  useEffect(() => setSugs(p.suggestions), [p.suggestions]);

  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<QuickPick[]>([]);
  const [chosen, setChosen] = useState<QuickPick | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const published = !ready || state === "published" || (state === "unset" && plans.length > 0);
  const draft = ready && !published;
  const version = plans.map((x) => x.id).join("-") || "empty";

  async function insertStarter(items: StarterItem[]) {
    if (!kutumbhId || !items.length) return true;
    const { error: err } = await supabase.from("meal_plans").insert(items.map((i) => ({
      user_id: userId, kutumbh_id: kutumbhId, planned_date: day, meal_slot: i.meal, food_name: i.name,
      quantity_g: 1, quantity_unit: i.unit ?? "serving", food_item_id: i.id,
    })));
    return !err;
  }

  // A new festival menu opens already filled, as a draft only the Key Member sees
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !isPrime || !ready || !kutumbhId || state !== "unset" || plans.length > 0 || !starter.length) return;
    started.current = true;
    (async () => {
      const { error: e1 } = await supabase.from("festival_menus").insert({ kutumbh_id: kutumbhId, festival_date: day });
      if (e1) return;                                    // someone else just started it
      await insertStarter(starter);
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resetToStarter() {
    if (!kutumbhId || busy) return;
    setBusy(true); setError(null);
    const { error: e0 } = await supabase.from("meal_plans").delete().eq("kutumbh_id", kutumbhId).eq("planned_date", day).eq("user_id", userId);
    const ok = !e0 && (await insertStarter(starter));
    if (ready && ok) await supabase.from("festival_menus").upsert({ kutumbh_id: kutumbhId, festival_date: day }, { onConflict: "kutumbh_id,festival_date", ignoreDuplicates: true });
    setBusy(false); setConfirmReset(false);
    if (!ok) setError("Could not set the traditional menu. Please try again.");
    router.refresh();
  }

  async function setPublished(on: boolean) {
    if (!kutumbhId || busy) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("festival_menus").upsert(
      { kutumbh_id: kutumbhId, festival_date: day, published_at: on ? new Date().toISOString() : null },
      { onConflict: "kutumbh_id,festival_date" });
    setBusy(false);
    if (err) setError("Could not change this. Please try again."); else router.refresh();
  }

  async function approve(s: Suggestion) {
    if (!kutumbhId || busy) return;
    setBusy(true); setError(null);
    let unit: string | null = null;
    if (s.food_item_id) {
      const { data } = await supabase.from("food_items").select("serving_unit").eq("id", s.food_item_id).maybeSingle();
      unit = data?.serving_unit ?? null;
    }
    const { error: e1 } = await supabase.from("meal_plans").insert({
      user_id: userId, kutumbh_id: kutumbhId, planned_date: day, meal_slot: s.meal_slot, food_name: s.food_name,
      quantity_g: 1, quantity_unit: unit ?? "serving", food_item_id: s.food_item_id,
    });
    if (e1) { setBusy(false); setError("Could not add this dish. Please try again."); return; }
    await supabase.from("festival_suggestions").update({ status: "approved" }).eq("id", s.id);
    setBusy(false);
    router.refresh();
  }

  async function decline(s: Suggestion) {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("festival_suggestions").update({ status: "declined" }).eq("id", s.id);
    setBusy(false);
    if (err) setError("Could not decline. Please try again."); else router.refresh();
  }

  async function sendSuggestion(slot: string) {
    if (!kutumbhId || !chosen || busy) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("festival_suggestions").insert({
      kutumbh_id: kutumbhId, festival_date: day, meal_slot: slot, food_item_id: chosen.id, food_name: chosen.name,
      note: note.trim() || null,
    });
    setBusy(false);
    if (err) { setError("Could not send your suggestion. Please try again."); return; }
    setSent(`${chosen.name} sent to the Key Member.`);
    setSuggesting(null); setChosen(null); setNote(""); setQuery(""); setFound([]);
    router.refresh();
  }

  // Search the dish catalogue for a suggestion
  useEffect(() => {
    if (!suggesting || !query.trim()) { setFound([]); return; }
    const q = query.trim();
    const t = setTimeout(async () => {
      const { data } = await supabase.from("food_items")
        .select("id, name, category, diet, meal_hint, recipe_id, calories, serving_weight_g, serving_unit, kutumbh_id, needs_review")
        .ilike("name", `%${q}%`).order("name").limit(8);
      setFound((data ?? []) as QuickPick[]);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, suggesting]);

  const slotPlans = (slot: string) => plans.filter((x) => x.meal_slot === slot);
  const valueOf = (slot: string) => sum(slotPlans(slot).flatMap((x) => (x.n ? [x.n] : [])));
  const dayTotal = sum(SLOTS.map((s) => valueOf(s.key)));
  const noValues = plans.filter((x) => !x.n).length;
  const pending = sugs.filter((s) => s.status === "pending");

  const when = daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;
  const pill = "px-4 rounded-full text-sm font-bold";

  return (
    <div className="flex flex-col gap-3">
      {/* Festival strip */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E4DBF0" }}>
        <div className="flex items-center justify-between px-3" style={{ background: PLUM, height: 48 }}>
          <Link href="/festivals" className="text-sm font-semibold text-white flex items-center" style={{ minHeight: 44 }}>‹ Festival days</Link>
          <span className="text-sm font-bold" style={{ color: "#F5B82E" }}>{when}</span>
        </div>
        <p className="px-3 py-2 text-sm font-bold" style={{ background: "#F7F3FC", color: INK }}>
          🪔 {festival} · <span className="font-semibold" style={{ color: MUTED }}>{dayLabel}</span>
        </p>
      </div>

      {hidden ? (
        <div className="rounded-2xl px-4 py-5" style={{ background: COOL.bg, border: `2.5px solid ${COOL.edge}` }}>
          <p className="m-0 text-sm font-bold" style={{ color: INK }}>The Key Member is still preparing this menu</p>
          <p className="m-0 mt-1 text-xs" style={{ color: MUTED }}>It shows here once it is published. Then you can suggest dishes for it.</p>
        </div>
      ) : (
        <>
          {/* Draft / published */}
          {isPrime && (
            <div className="rounded-2xl px-3 py-3 flex flex-col gap-2" style={{ background: draft ? "#FFF6D6" : "#E6F6EA", border: `2px solid ${draft ? "#C99A06" : "#2E8B57"}` }}>
              {ready ? (
                <>
                  <p className="m-0 text-sm font-bold" style={{ color: INK }}>
                    {draft ? "Draft · only you can see this" : "Published · the family can see it"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {draft
                      ? <button onClick={() => setPublished(true)} disabled={busy || !plans.length} className={`${pill} text-white disabled:opacity-40`} style={{ background: PLUM, minHeight: 44 }}>Publish menu</button>
                      : <button onClick={() => setPublished(false)} disabled={busy} className={pill} style={{ minHeight: 44, border: `1.5px solid ${PLUM}`, color: PLUM, background: "#fff" }}>Back to draft</button>}
                    {!confirmReset
                      ? <button onClick={() => setConfirmReset(true)} disabled={busy} className="px-3 text-xs font-semibold underline" style={{ color: PLUM, minHeight: 44 }}>
                          {plans.length ? `Reset to the traditional ${festival} menu` : `Start with the traditional ${festival} menu`}
                        </button>
                      : <span className="flex items-center gap-2 text-xs" style={{ color: INK }}>
                          {plans.length ? "Replace your dishes?" : "Fill the day?"}
                          <button onClick={resetToStarter} disabled={busy} className="px-3 rounded-full font-bold text-white" style={{ background: PLUM, minHeight: 44 }}>Yes</button>
                          <button onClick={() => setConfirmReset(false)} className="px-3 font-semibold underline" style={{ minHeight: 44, color: PLUM }}>No</button>
                        </span>}
                  </div>
                </>
              ) : (
                <>
                  <p className="m-0 text-sm font-bold" style={{ color: INK }}>Draft, publish and suggestions need a one-time setup</p>
                  <p className="m-0 text-xs" style={{ color: MUTED }}>Until then, whatever you add shows to the family straight away.</p>
                  {!plans.length && (
                    <button onClick={resetToStarter} disabled={busy} className={`${pill} text-white self-start`} style={{ background: PLUM, minHeight: 44 }}>Start with the traditional {festival} menu</button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Food values of the menu */}
          <div className="rounded-2xl px-3 py-3 flex flex-col gap-2.5" style={{ background: WARM.bg, border: `2.5px solid ${WARM.edge}` }} aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <p className="m-0 text-sm font-bold" style={{ color: INK }}>Food Values of the Festival Menu</p>
              <p className="m-0 text-xs" style={{ color: MUTED }}>{Math.round(dayTotal.kcal)} kcal</p>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {SLOTS.map((s) => (
                <div key={s.key} className="flex flex-col items-center text-center min-w-0">
                  <span className="text-sm font-bold leading-[18px]" style={{ color: INK }}>{Math.round(valueOf(s.key).kcal) || "–"}</span>
                  <span className="text-[10px] leading-3 truncate" style={{ color: MUTED }}>{s.label.replace(" Snack", " snack")}</span>
                </div>
              ))}
            </div>
            <div className="pt-2" style={{ borderTop: "1px solid rgba(194,85,31,0.30)" }}>
              <Values title="" color={MUTED} cells={nutrientCells(dayTotal)} />
            </div>
            <Values title="" color={MUTED} cells={microCells(dayTotal)} />
            {!plans.length && <p className="m-0 text-[11px]" style={{ color: MUTED }}>No dishes yet · values appear as you plan</p>}
            {noValues > 0 && <p className="m-0 text-[11px]" style={{ color: MUTED }}>{noValues} {noValues === 1 ? "dish" : "dishes"} without values · excluded</p>}
            <p className="m-0 text-[11px]" style={{ color: MUTED }}>Estimates · IFCT-based</p>
          </div>

          {isPrime && pending.length > 0 && (
            <p className="m-0 px-1 text-sm font-bold" style={{ color: "#8A5A06" }}>
              💡 {pending.length} {pending.length === 1 ? "suggestion" : "suggestions"} waiting for you
            </p>
          )}
          {sent && <p className="m-0 px-1 text-sm font-semibold" style={{ color: "#2E8B57" }}>✓ {sent}</p>}

          {/* The five meals, open for planning */}
          {SLOTS.map(({ key, label, icon, time }) => {
            const ps = slotPlans(key);
            const tot = valueOf(key);
            const mine = sugs.filter((s) => s.meal_slot === key && (isPrime ? s.status === "pending" : s.suggested_by === userId && s.status !== "approved"));
            return (
              <div key={key} className="rounded-2xl overflow-hidden" style={{ background: COOL.bg, border: `2.5px solid ${COOL.edge}` }}>
                {/* The title bar is the way in: the Key Member taps it to change the meal */}
                <button type="button" disabled={!isPrime} onClick={() => setEditing((e) => ({ ...e, [key]: !e[key] }))}
                  aria-expanded={isPrime ? !!editing[key] : undefined}
                  className="w-full flex items-center justify-between gap-2 px-3 text-left"
                  style={{ minHeight: 56, background: COOL.open, cursor: isPrime ? "pointer" : "default" }}>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-lg" aria-hidden>{icon}</span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm font-bold" style={{ color: INK }}>{label}</span>
                      <span className="text-xs" style={{ color: MUTED }}>{ps.length ? `${ps.length} ${ps.length === 1 ? "dish" : "dishes"}` : "Nothing planned yet"} · {time}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold tabular-nums" style={{ color: INK }}>{Math.round(tot.kcal) ? `${Math.round(tot.kcal)} kcal` : "–"}</span>
                    {isPrime && <span aria-hidden style={{ color: PLUM, transform: editing[key] ? "rotate(180deg)" : undefined }}>⌄</span>}
                  </span>
                </button>

                <div className="px-3 pb-3 pt-2 flex flex-col gap-1.5">
                  {ps.map((x) => (
                    <div key={x.id} className="flex items-center gap-3 px-2.5 rounded-xl" style={{ minHeight: 48, background: "#fff", border: "1.5px solid #D9CBF0" }}>
                      <span className="flex flex-col min-w-0 text-left">
                        <span className="text-sm" style={{ color: INK }}>{x.food_name}</span>
                        <span className="text-xs" style={{ color: MUTED }}>
                          {x.kcal_per_serving != null ? `${x.kcal_per_serving} kcal / ${x.serving_unit === "g" ? "100 g" : (x.serving_unit ?? "serving")}` : "No values yet"}
                        </span>
                      </span>
                      {x.recipe_id != null && (
                        <Link href={`/recipes/${x.recipe_id}`} className="text-[11px] font-semibold ml-auto px-1 flex-shrink-0" style={{ color: "#6B46B8" }}>📖 Recipe</Link>
                      )}
                    </div>
                  ))}

                  {mine.map((s) => (
                    <div key={s.id} className="rounded-xl px-3 py-2" style={{ background: s.status === "declined" ? "#F4F4F6" : "#FFF6D6", border: `1.5px dashed ${s.status === "declined" ? "#B9B2C9" : "#C99A06"}` }}>
                      <p className="m-0 text-sm" style={{ color: INK }}>
                        💡 {isPrime ? `${p.memberNames[s.suggested_by] ?? "A member"} suggests ` : "You suggested "}<b>{s.food_name}</b>
                      </p>
                      {s.note && <p className="m-0 text-xs italic" style={{ color: MUTED }}>&ldquo;{s.note}&rdquo;</p>}
                      {isPrime ? (
                        <div className="flex gap-2 pt-1.5">
                          <button onClick={() => approve(s)} disabled={busy} className={`${pill} text-white disabled:opacity-50`} style={{ background: "#2E8B57", minHeight: 44 }}>✓ Approve</button>
                          <button onClick={() => decline(s)} disabled={busy} className={`${pill} disabled:opacity-50`} style={{ minHeight: 44, border: "1.5px solid #B42318", color: "#B42318", background: "#fff" }}>✕ Decline</button>
                        </div>
                      ) : (
                        <p className="m-0 text-xs font-semibold" style={{ color: s.status === "declined" ? MUTED : "#8A5A06" }}>
                          {s.status === "declined" ? "Not added this time" : "Waiting for the Key Member"}
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {!isPrime && ready && (
                      <button onClick={() => { setSuggesting(suggesting === key ? null : key); setChosen(null); setQuery(""); setNote(""); }} className={pill}
                        style={{ minHeight: 44, border: `1.5px solid ${PLUM}`, color: PLUM, background: "#fff" }}>
                        {suggesting === key ? "Cancel" : "💡 Suggest a dish"}
                      </button>
                    )}
                  </div>

                  {isPrime && editing[key] && (
                    <PlanSlotCard key={`${key}-${version}`} slotKey={key} name={label} icon={icon} time={time}
                      userId={userId} kutumbhId={kutumbhId} plannedDate={day}
                      embedded quickPicks={p.quickPicks[key]} quickLabel={`Made for ${festival}`}
                      initialItems={ps} initialPoolName={p.poolNames[key] ?? null} memberNames={p.memberNames} />
                  )}

                  {!isPrime && suggesting === key && (
                    <div className="rounded-xl px-3 py-3 flex flex-col gap-2" style={{ background: "#fff", border: "1.5px solid #C9DDF3" }}>
                      <input value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null); }} placeholder="Search a dish"
                        aria-label="Search a dish" className="w-full rounded-xl px-3 py-2 text-sm"
                        style={{ border: "1.5px solid #6B46B8", background: "#FAF7FE", color: INK, outline: "none" }} />
                      {!chosen && (
                        <div className="rounded-xl overflow-y-auto" style={{ border: "1px solid #E0D4F2", maxHeight: 240 }}>
                          {(query.trim() ? found : (p.quickPicks[key] ?? [])).filter((f) => !ps.some((x) => x.food_name === f.name)).map((f, i) => (
                            <button key={f.id} type="button" onClick={() => setChosen(f)} className="w-full text-left px-3 py-2 text-sm flex justify-between gap-2"
                              style={{ borderTop: i ? "1px solid #F0EAFA" : undefined, color: INK, minHeight: 44 }}>
                              <span className="truncate">{f.name}</span>
                              <span className="text-xs flex-shrink-0" style={{ color: MUTED }}>{kcalOf(f) != null ? `${kcalOf(f)} kcal` : ""}</span>
                            </button>
                          ))}
                          {query.trim() && found.length === 0 && <p className="m-0 text-xs text-center py-3" style={{ color: MUTED }}>No dish found</p>}
                        </div>
                      )}
                      {chosen && (
                        <>
                          <p className="m-0 text-sm" style={{ color: INK }}>Suggest <b>{chosen.name}</b> for {label}</p>
                          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add a note (optional)"
                            aria-label="Note" className="w-full rounded-xl px-3 py-2 text-sm"
                            style={{ border: "1.5px solid #CBBDE4", background: "#FAF7FE", color: INK, outline: "none" }} />
                          <button onClick={() => sendSuggestion(key)} disabled={busy} className={`${pill} text-white disabled:opacity-50`} style={{ background: PLUM, minHeight: 44 }}>
                            Send to the Key Member
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {error && <p className="px-3 py-2 text-xs" style={{ color: "#B42318" }}>{error}</p>}
    </div>
  );
}
