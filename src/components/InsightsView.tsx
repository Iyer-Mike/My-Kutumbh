"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CorrectionEvent, IntakeSummary, LabFlag, Needs, NutrientKey } from "@/lib/insights/types";
import type { AyurvedaSummary, Rasa } from "@/lib/insights/ayurveda";
import { energyNarrative, microNarrative, trendNarrative, ayurvedaNarrative, labNarrative } from "@/lib/insights/narrate";
import CoachChat from "@/components/CoachChat";

export type InsightsPeriod = {
  key: "today" | "week" | "month";
  label: string;
  intake: IntakeSummary;
  ayurveda: AyurvedaSummary;
  flags: LabFlag[];
  events: CorrectionEvent[];
};

type Props = {
  periods: InsightsPeriod[];
  needs: Needs;
  primaryDosha: string | null;
  hasReport: boolean;
  viewingOther: boolean;
  memberId: string | null;
  firstName: string;
};

const SEVERITY: Record<CorrectionEvent["severity"], { label: string; bg: string; fg: string }> = {
  alert: { label: "Alert", bg: "#FBE2DC", fg: "#9A2C1B" },
  watch: { label: "Watch", bg: "#FBEBCF", fg: "#7E4A08" },
  tip:   { label: "Tip",   bg: "#DDE9F6", fg: "#1F4A78" },
};
const CATEGORY: Record<CorrectionEvent["category"], string> = {
  medicine: "Medicine & food", allergy: "Allergy", condition: "Condition", pattern: "Lab pattern",
};

function eventsNarrative(events: CorrectionEvent[]): string {
  if (!events.length) return "Nothing needs attention right now.";
  const n = (s: CorrectionEvent["severity"]) => events.filter((e) => e.severity === s).length;
  const parts = [
    n("alert") && `${n("alert")} alert${n("alert") === 1 ? "" : "s"}`,
    n("watch") && `${n("watch")} to watch`,
    n("tip") && `${n("tip")} tip${n("tip") === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `${parts.join(", ")} — ${events[0].title.toLowerCase()}${events.length > 1 ? " and more" : ""}.`;
}

function EventCard({ e }: { e: CorrectionEvent }) {
  const s = SEVERITY[e.severity];
  return (
    <div className="grid gap-1.5 py-3" style={{ borderTop: "1px solid #E0D4F2" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6A6180" }}>{CATEGORY[e.category]}</span>
      </div>
      <p className="text-base font-bold" style={{ color: "#4B2A7A" }}>{e.title}</p>
      <p className="text-sm" style={{ color: "#3D3550" }}>{e.detail}</p>
      <p className="text-sm" style={{ color: "#1F1A2B" }}><b>Do this:</b> {e.action}</p>
      {e.evidence.length > 0 && (
        <p className="text-xs" style={{ color: "#6A6180" }}>Based on: {e.evidence.join(" · ")}</p>
      )}
    </div>
  );
}

// Higher-contrast text than the rest of the app, as this page is read closely
const C = {
  ink: "#1F1A2B", ink2: "#3D3550", ink3: "#6A6180", rule: "#E0D4F2", track: "#E7E0F3",
  leaf: "#2F7A35", warn: "#C2551F", low: "#B4441A", lowSoft: "#FCE5DA",
};

type Theme = { bar: string; text: string; accent: string };
const THEME: Record<"alerts" | "coach" | "energy" | "lab" | "micro" | "ayurveda" | "trend", Theme> = {
  alerts:   { bar: "#ECE3F7", text: "#4B2A7A", accent: "#6B3FA0" },
  coach:    { bar: "#EDE4FA", text: "#33215C", accent: "#4B2D7A" },
  energy:   { bar: "#E1F0DE", text: "#1F5E25", accent: "#2F7A35" },
  lab:      { bar: "#FBE2DC", text: "#8E2A1B", accent: "#B23A26" },
  micro:    { bar: "#DDE9F6", text: "#1F4A78", accent: "#2E64A0" },
  ayurveda: { bar: "#FBEBCF", text: "#7E4A08", accent: "#B06A10" },
  trend:    { bar: "#DAF0EC", text: "#155B55", accent: "#1F7D74" },
};

// Colour for each finding's title
const GROUP_COLOR: Record<string, string> = {
  sugar: "#C2551F", lipids: "#B23A26", iron: "#8E3B6A", inflammation: "#A8620C",
  kidney: "#2E64A0", liver: "#6A5A12", vitamin_d: "#9A7A00", vitamin_b12: "#6B4FA0",
  other: "#6A6180",
};

const MICROS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: "iron_mg", label: "Iron", unit: "mg" },
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "vitamin_b12_mcg", label: "Vitamin B12", unit: "mcg" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { key: "folate_mcg", label: "Folate", unit: "mcg" },
  { key: "potassium_mg", label: "Potassium", unit: "mg" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

const RASA_LABEL: Record<Rasa, string> = {
  sweet: "Sweet", sour: "Sour", salty: "Salty", pungent: "Pungent", bitter: "Bitter", astringent: "Astringent",
};

const NUTRIENT_WORD: Partial<Record<NutrientKey, string>> = {
  fiber_g: "fibre", iron_mg: "iron", calcium_mg: "calcium", vitamin_b12_mcg: "B12",
  folate_mcg: "folate", potassium_mg: "potassium",
};

// Big numbers whole, mid-range to one decimal, small lab values kept precise
const fmt = (x: number) =>
  Math.abs(x) >= 100 ? Math.round(x).toLocaleString("en-IN")
  : Math.abs(x) >= 10 ? (Math.round(x * 10) / 10).toString()
  : parseFloat(x.toFixed(3)).toString();
const pct = (x: number) => `${Math.round(x * 100)}%`;

const STORE_KEY = "insights-open-v2";
const DEFAULT_OPEN: Record<string, boolean> = {
  alerts: true, energy: false, lab: true, micro: false, ayurveda: false, trend: false, coach: false,
};

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
      <path d="M3 5l4 4 4-4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A collapsible section with a coloured title bar and a one-line narration. */
function Section({ id, title, theme, summary, open, onToggle, aside, children }: {
  id: string; title: string; theme: Theme; summary: string; open: boolean;
  onToggle: () => void; aside?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "#FAF7FE", border: `1px solid ${C.rule}` }}>
      <button onClick={onToggle} aria-expanded={open} aria-controls={`sec-${id}`}
        className="w-full text-left px-4 py-3 grid gap-1" style={{ background: theme.bar }}>
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: theme.text }}>{title}</span>
          <span className="flex items-center gap-2">
            {aside && <span className="text-xs font-medium" style={{ color: theme.text }}>{aside}</span>}
            <Chevron open={open} color={theme.text} />
          </span>
        </span>
        <span className="text-sm leading-snug" style={{ color: C.ink }}>{summary}</span>
      </button>
      {open && <div id={`sec-${id}`} className="px-4 py-4">{children}</div>}
    </section>
  );
}

/** A labelled bar against a goal (or a limit, which turns orange when passed). */
function MeterRow({ label, have, target, unit, limit = false, accent }: {
  label: string; have: number; target: number; unit: string; limit?: boolean; accent: string;
}) {
  const ratio = target > 0 ? have / target : 0;
  const over = limit && ratio > 1;
  const color = over ? C.warn : limit ? accent : ratio >= 0.9 ? accent : ratio >= 0.6 ? "#8A9A2F" : C.low;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium" style={{ color: C.ink }}>{label}</span>
        <span className="tabular-nums text-xs font-medium" style={{ color: over ? C.warn : C.ink2 }}>
          {fmt(have)} / {fmt(target)} {unit}{limit ? " limit" : ""} · {Math.round(ratio * 100)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.track }}>
        <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function Trend({ daily, target, accent }: { daily: { date: string; kcal: number }[]; target: number; accent: string }) {
  const W = 320, H = 120, padL = 32, padB = 18, padT = 8;
  const max = Math.max(target * 1.25, ...daily.map((d) => d.kcal), 1);
  const bw = (W - padL) / daily.length;
  const y = (v: number) => H - padB - (v / max) * (H - padB - padT);
  const every = daily.length > 10 ? 7 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily energy intake against target">
      {daily.map((d, i) => (
        <rect key={d.date} x={padL + i * bw + bw * 0.15} y={y(d.kcal)} width={bw * 0.7}
          height={Math.max(0, H - padB - y(d.kcal))} rx={2}
          fill={d.kcal === 0 ? C.track : d.kcal > target * 1.1 ? C.warn : accent} />
      ))}
      <line x1={padL} x2={W} y1={y(target)} y2={y(target)} stroke={C.ink2} strokeDasharray="4 3" strokeWidth={1} />
      <text x={padL - 4} y={y(target) + 3} textAnchor="end" fontSize="8.5" fill={C.ink2}>{fmt(target)}</text>
      <text x={padL - 4} y={H - padB + 3} textAnchor="end" fontSize="8.5" fill={C.ink2}>0</text>
      {daily.map((d, i) => (i % every === 0 || i === daily.length - 1) && (
        <text key={`l${d.date}`} x={padL + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="8.5" fill={C.ink2}>
          {Number(d.date.slice(8))}
        </text>
      ))}
    </svg>
  );
}

function Readings({ f }: { f: LabFlag }) {
  return (
    <ul className="grid gap-1">
      {f.readings.map((r) => (
        <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: C.lowSoft, color: C.low }}>
            {r.status === "low" ? "Low" : "High"}
          </span>
          <span className="font-medium" style={{ color: C.ink }}>{r.label}</span>
          <span className="tabular-nums text-xs" style={{ color: C.ink2 }}>
            <b style={{ color: C.ink }}>{fmt(r.value)}</b>{r.unit ? ` ${r.unit}` : ""} · normal {r.range}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One lab finding: coloured title and readings always visible; advice expands. */
function Finding({ f, repeatOf, open, onToggle }: { f: LabFlag; repeatOf: boolean; open: boolean; onToggle: () => void }) {
  const color = GROUP_COLOR[f.key] ?? THEME.lab.accent;
  const hasAdvice = f.known && (f.favour.length > 0 || f.limit.length > 0 || f.favourFoods.length > 0 || !!f.intakeNote);
  return (
    <div className="grid gap-2 py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <button onClick={onToggle} disabled={!hasAdvice} aria-expanded={hasAdvice ? open : undefined}
        className="flex items-center justify-between gap-2 text-left">
        <span className="text-base font-bold" style={{ color }}>{f.label}</span>
        {hasAdvice && (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
            {open ? "Hide advice" : "What to eat"} <Chevron open={open} color={color} />
          </span>
        )}
      </button>
      <Readings f={f} />
      <p className="text-sm" style={{ color: f.known ? C.ink2 : C.ink3 }}>{f.meaning}</p>

      {hasAdvice && open && (
        <div className="grid gap-2.5 rounded-xl px-3 py-3" style={{ background: "#FAF9F4" }}>
          {(f.favour.length > 0 || f.favourFoods.length > 0) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.leaf }}>Eat more of</p>
              <ul className="grid gap-0.5 text-sm list-disc pl-5" style={{ color: C.ink }}>
                {f.favour.map((x) => <li key={x}>{x}</li>)}
              </ul>
              {f.favourFoods.length > 0 && (repeatOf ? (
                <p className="text-xs mt-1" style={{ color: C.ink3 }}>
                  Same {f.nutrient ? NUTRIENT_WORD[f.nutrient] ?? "" : ""}-rich foods as above.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {f.favourFoods.map((n) => (
                    <span key={n} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#E1F0DE", color: "#1F5E25" }}>{n}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {f.limit.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: C.warn }}>Limit</p>
              <ul className="grid gap-0.5 text-sm list-disc pl-5" style={{ color: C.ink }}>
                {f.limit.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          )}
          {f.intakeNote && (
            <p className="text-sm rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "#FBEBCF", color: "#6A3D06" }}>{f.intakeNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InsightsView({ periods, needs, primaryDosha, hasReport, viewingOther, memberId, firstName }: Props) {
  const [key, setKey] = useState<InsightsPeriod["key"]>("week");
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [openFinding, setOpenFinding] = useState<Record<string, boolean>>({});

  // Remember which sections this viewer keeps open (a convenience only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setOpen({ ...DEFAULT_OPEN, ...JSON.parse(saved) });
    } catch { /* storage unavailable — keep defaults */ }
  }, []);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const p = periods.find((x) => x.key === key) ?? periods[0];
  const { intake, ayurveda, flags, events } = p;
  const nothing = intake.items === 0;
  const perLabel = key === "today" ? "today" : `a day, over ${intake.loggedDays} logged day${intake.loggedDays === 1 ? "" : "s"}`;
  const firstKnown = flags.find((f) => f.known)?.key;
  const isFindingOpen = (k: string) => openFinding[k] ?? k === firstKnown;

  return (
    <div className="grid gap-3">
      {/* Period switch */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#E4E2D9" }} role="tablist" aria-label="Period">
        {periods.map((x) => (
          <button key={x.key} role="tab" aria-selected={x.key === key} onClick={() => setKey(x.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: x.key === key ? "#241238" : "transparent", color: x.key === key ? "#fff" : C.ink2 }}>
            {x.label}
          </button>
        ))}
      </div>

      {nothing && (
        <div className="rounded-2xl px-4 py-4 text-sm font-medium" style={{ background: "#FBEBCF", color: "#6A3D06", border: "1px solid #F2B531" }}>
          No meals logged {key === "today" ? "today" : `in the last ${intake.days} days`}.
          {!viewingOther && <> <Link href="/log" className="font-bold underline">Log a meal</Link> to see your nutrition.</>}
        </div>
      )}

      <Section id="alerts" title="Health alerts & tips" theme={THEME.alerts} open={open.alerts} onToggle={() => toggle("alerts")}
        summary={eventsNarrative(events)} aside={events.length ? `${events.length}` : undefined}>
        {events.length === 0 ? (
          <p className="text-sm" style={{ color: C.ink2 }}>
            No medicine, allergy or lab-pattern concerns found for this period. Keep your profile&apos;s conditions, allergies and
            medications up to date so this stays accurate.
          </p>
        ) : (
          <>
            <p className="text-sm -mt-1" style={{ color: C.ink2 }}>
              Personal checks that connect {viewingOther ? `${firstName}'s` : "your"} medicines, allergies, conditions and lab results with the food logged.
            </p>
            {events.map((e) => <EventCard key={e.id} e={e} />)}
          </>
        )}
      </Section>

      {!nothing && (
        <Section id="energy" title="Energy" theme={THEME.energy} open={open.energy} onToggle={() => toggle("energy")}
          summary={energyNarrative(intake, needs)} aside={needs.kcal.source === "your daily goal" ? "your goal" : "estimated target"}>
          <p className="text-3xl font-bold tabular-nums" style={{ color: C.ink }}>
            {fmt(intake.perDay.kcal)} <span className="text-base font-medium" style={{ color: C.ink2 }}>kcal {perLabel}</span>
          </p>
          <div className="grid gap-3 mt-3">
            <MeterRow accent={THEME.energy.accent} label="Energy" have={intake.perDay.kcal} target={needs.kcal.value} unit="kcal" />
            <MeterRow accent={THEME.energy.accent} label="Protein" have={intake.perDay.protein_g} target={needs.protein_g.value} unit="g" />
            <MeterRow accent={THEME.energy.accent} label="Carbohydrate" have={intake.perDay.carbs_g} target={needs.carbs_g.value} unit="g" />
            <MeterRow accent={THEME.energy.accent} label="Fat" have={intake.perDay.fat_g} target={needs.fat_g.value} unit="g" />
            <MeterRow accent={THEME.energy.accent} label="Fibre" have={intake.perDay.fiber_g} target={needs.fiber_g.value} unit="g" />
          </div>
          {intake.estimatedShare > 0.05 && (
            <p className="text-xs mt-3 font-medium" style={{ color: THEME.ayurveda.text }}>
              {pct(intake.estimatedShare)} of this energy is estimated (Family Dishes awaiting details, or photos of outside food).
            </p>
          )}
        </Section>
      )}

      <Section id="lab" title={viewingOther ? "From the lab report" : "From your lab report"} theme={THEME.lab}
        open={open.lab} onToggle={() => toggle("lab")} summary={labNarrative(flags, hasReport)}>
        {!hasReport ? (
          <p className="text-sm" style={{ color: C.ink2 }}>
            No lab report yet.
            {!viewingOther && <> Upload one on <Link href="/profile" className="font-bold underline" style={{ color: THEME.lab.accent }}>Profile</Link> to get food guidance based on your results.</>}
          </p>
        ) : flags.length === 0 ? (
          <p className="text-sm font-medium" style={{ color: C.leaf }}>All values in the latest report are within the normal range.</p>
        ) : (
          <>
            <p className="text-sm -mt-1" style={{ color: C.ink2 }}>
              {flags.reduce((s, f) => s + f.readings.length, 0)} values outside the normal range. Tap a finding to see what to eat.
            </p>
            {flags.map((f, i) => (
              <Finding key={f.key} f={f}
                open={isFindingOpen(f.key)}
                onToggle={() => setOpenFinding((prev) => ({ ...prev, [f.key]: !isFindingOpen(f.key) }))}
                repeatOf={f.favourFoods.length > 0 && flags.slice(0, i).some((g) => g.favourFoods.join("|") === f.favourFoods.join("|"))} />
            ))}
            <p className="text-xs pt-3" style={{ color: C.ink3, borderTop: `1px solid ${C.rule}` }}>
              General guidance only, not medical advice. Always follow your doctor&apos;s advice, especially about supplements and medicines.
            </p>
          </>
        )}
      </Section>

      {!nothing && (
        <Section id="micro" title="Vitamins & minerals" theme={THEME.micro} open={open.micro} onToggle={() => toggle("micro")}
          summary={microNarrative(intake, needs)} aside="ICMR-NIN 2020">
          <div className="grid gap-3">
            {MICROS.map((m) => (
              <MeterRow key={m.key} accent={THEME.micro.accent} label={m.label} unit={m.unit}
                have={intake.perDay[m.key]} target={needs[m.key].value} limit={needs[m.key].kind === "limit"} />
            ))}
          </div>
          {intake.microCoverage < 0.8 && (
            <p className="text-xs mt-3 font-medium" style={{ color: THEME.micro.text }}>
              Only {pct(intake.microCoverage)} of the logged food has vitamin and mineral data, so these may read low.
              Completing Family Dishes and logging from the food list helps.
            </p>
          )}
        </Section>
      )}

      {!nothing && (
        <Section id="ayurveda" title="Ayurveda" theme={THEME.ayurveda} open={open.ayurveda} onToggle={() => toggle("ayurveda")}
          summary={ayurvedaNarrative(ayurveda)} aside={primaryDosha ? `${primaryDosha[0].toUpperCase()}${primaryDosha.slice(1)} Prakriti` : undefined}>
          {ayurveda.coverage === 0 ? (
            <p className="text-sm" style={{ color: C.ink2 }}>The foods logged don&apos;t have Ayurvedic data yet.</p>
          ) : (
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-bold mb-2" style={{ color: THEME.ayurveda.text }}>Six tastes</p>
                <div className="grid gap-1.5">
                  {(Object.keys(RASA_LABEL) as Rasa[]).map((r) => (
                    <div key={r} className="grid items-center gap-2" style={{ gridTemplateColumns: "82px 1fr 38px" }}>
                      <span className="text-sm" style={{ color: C.ink }}>{RASA_LABEL[r]}</span>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.track }}>
                        <div className="h-2.5 rounded-full" style={{ width: pct(ayurveda.tasteShare[r]), background: ayurveda.tasteShare[r] < 0.03 ? C.low : THEME.ayurveda.accent }} />
                      </div>
                      <span className="text-xs tabular-nums text-right font-medium" style={{ color: C.ink2 }}>{pct(ayurveda.tasteShare[r])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-2" style={{ color: THEME.ayurveda.text }}>Heating vs cooling</p>
                <div className="flex h-3 rounded-full overflow-hidden" style={{ background: C.track }}>
                  <div style={{ width: pct(ayurveda.virya.heating), background: "#D4573A" }} />
                  <div style={{ width: pct(ayurveda.virya.neutral), background: "#B9B3A2" }} />
                  <div style={{ width: pct(ayurveda.virya.cooling), background: "#3F7FB8" }} />
                </div>
                <div className="flex justify-between text-xs mt-1 font-medium" style={{ color: C.ink2 }}>
                  <span>Heating {pct(ayurveda.virya.heating)}</span>
                  <span>Neutral {pct(ayurveda.virya.neutral)}</span>
                  <span>Cooling {pct(ayurveda.virya.cooling)}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-2" style={{ color: THEME.ayurveda.text }}>Effect on each dosha</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["vata", "pitta", "kapha"] as const).map((d) => {
                    const net = ayurveda.doshaNet[d];
                    const mine = ayurveda.primaryDoshas.includes(d);
                    const word = net > 0.15 ? "Balancing" : net < -0.15 ? "Aggravating" : "Neutral";
                    return (
                      <div key={d} className="rounded-xl px-2 py-2 text-center"
                        style={{ background: mine ? "#FBEBCF" : "#F3EEFA", border: mine ? "1px solid #F2B531" : `1px solid ${C.rule}` }}>
                        <p className="text-sm font-bold capitalize" style={{ color: C.ink }}>{d}{mine ? " ★" : ""}</p>
                        <p className="text-xs font-semibold" style={{ color: net < -0.15 ? C.warn : net > 0.15 ? C.leaf : C.ink3 }}>{word}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {ayurveda.notes.length > 0 && (
                <ul className="grid gap-1 text-sm list-disc pl-5" style={{ color: C.ink }}>
                  {ayurveda.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
          )}
        </Section>
      )}

      {!nothing && key !== "today" && (
        <Section id="trend" title="Daily energy" theme={THEME.trend} open={open.trend} onToggle={() => toggle("trend")}
          summary={trendNarrative(intake.daily, needs.kcal.value)} aside="dashed = target">
          <Trend daily={intake.daily} target={needs.kcal.value} accent={THEME.trend.accent} />
        </Section>
      )}

      <Section id="coach" title="Ask the coach" theme={THEME.coach} open={open.coach} onToggle={() => toggle("coach")}
        summary={viewingOther
          ? `Ask questions about ${firstName}'s food and health, answered from their own data.`
          : "Ask questions about your food and health, answered from your own data."}>
        <CoachChat memberId={memberId} firstName={firstName} viewingOther={viewingOther} />
      </Section>
    </div>
  );
}
