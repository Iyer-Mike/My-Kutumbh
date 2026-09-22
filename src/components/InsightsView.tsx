"use client";

import { useState } from "react";
import Link from "next/link";
import type { IntakeSummary, LabFlag, Needs, NutrientKey } from "@/lib/insights/types";
import type { AyurvedaSummary, Rasa } from "@/lib/insights/ayurveda";

export type InsightsPeriod = {
  key: "today" | "week" | "month";
  label: string;
  intake: IntakeSummary;
  ayurveda: AyurvedaSummary;
  flags: LabFlag[];
};

type Props = {
  periods: InsightsPeriod[];
  needs: Needs;
  primaryDosha: string | null;
  hasReport: boolean;
  viewingOther: boolean;
};

const C = {
  ink: "#1C201C", ink2: "#5A6055", ink3: "#8A9085", rule: "#E2E1D8",
  leaf: "#4A7C44", leafSoft: "#EAF2E8", track: "#EDECE4",
  warn: "#C8632A", warnSoft: "#FBEFD9", saffron: "#A5661A",
  low: "#B4541A", lowSoft: "#FDEDE2",
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

const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString("en-IN") : (Math.round(x * 10) / 10).toString());
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#fff", border: `1px solid ${C.rule}` }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.ink3 }}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A labelled bar against a goal (or a limit, which turns orange when passed). */
function MeterRow({ label, have, target, unit, limit = false }: { label: string; have: number; target: number; unit: string; limit?: boolean }) {
  const ratio = target > 0 ? have / target : 0;
  const over = limit && ratio > 1;
  const color = over ? C.warn : limit ? C.leaf : ratio >= 0.9 ? C.leaf : ratio >= 0.6 ? "#8AA83F" : C.low;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span style={{ color: C.ink }}>{label}</span>
        <span className="tabular-nums text-xs" style={{ color: over ? C.warn : C.ink2 }}>
          {fmt(have)} / {fmt(target)} {unit}{limit ? " limit" : ""}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.track }}>
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function Trend({ daily, target }: { daily: { date: string; kcal: number }[]; target: number }) {
  const W = 320, H = 110, padL = 30, padB = 18, padT = 8;
  const max = Math.max(target * 1.25, ...daily.map((d) => d.kcal), 1);
  const bw = (W - padL) / daily.length;
  const y = (v: number) => H - padB - (v / max) * (H - padB - padT);
  const every = daily.length > 10 ? 7 : 1;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily energy intake">
        {daily.map((d, i) => (
          <rect key={d.date} x={padL + i * bw + bw * 0.15} y={y(d.kcal)} width={bw * 0.7}
            height={Math.max(0, H - padB - y(d.kcal))} rx={2}
            fill={d.kcal === 0 ? C.track : d.kcal > target ? C.warn : C.leaf} />
        ))}
        <line x1={padL} x2={W} y1={y(target)} y2={y(target)} stroke={C.ink3} strokeDasharray="4 3" strokeWidth={1} />
        <text x={padL - 4} y={y(target) + 3} textAnchor="end" fontSize="8" fill={C.ink3}>{fmt(target)}</text>
        <text x={padL - 4} y={H - padB + 3} textAnchor="end" fontSize="8" fill={C.ink3}>0</text>
        {daily.map((d, i) => (i % every === 0 || i === daily.length - 1) && (
          <text key={`l${d.date}`} x={padL + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="8" fill={C.ink3}>
            {Number(d.date.slice(8))}
          </text>
        ))}
      </svg>
    </div>
  );
}

function FlagItem({ f }: { f: LabFlag }) {
  const low = f.status === "low";
  return (
    <div className="grid gap-2 py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{f.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: C.lowSoft, color: C.low }}>
          {low ? "Low" : "High"}
        </span>
        <span className="text-xs tabular-nums" style={{ color: C.ink2 }}>
          {fmt(f.value)} {f.unit} · normal {f.range}
        </span>
      </div>
      <p className="text-sm" style={{ color: C.ink2 }}>{f.meaning}</p>

      {(f.favour.length > 0 || f.favourFoods.length > 0) && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: C.leaf }}>Eat more of</p>
          <ul className="grid gap-0.5 text-sm list-disc pl-5" style={{ color: C.ink2 }}>
            {f.favour.map((x) => <li key={x}>{x}</li>)}
          </ul>
          {f.favourFoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {f.favourFoods.map((n) => (
                <span key={n} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.leafSoft, color: "#2E5A28" }}>{n}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {f.limit.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: C.warn }}>Limit</p>
          <ul className="grid gap-0.5 text-sm list-disc pl-5" style={{ color: C.ink2 }}>
            {f.limit.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}

      {f.intakeNote && (
        <p className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: C.warnSoft, color: "#7A4C12" }}>{f.intakeNote}</p>
      )}
    </div>
  );
}

export default function InsightsView({ periods, needs, primaryDosha, hasReport, viewingOther }: Props) {
  const [key, setKey] = useState<InsightsPeriod["key"]>("week");
  const p = periods.find((x) => x.key === key) ?? periods[0];
  const { intake, ayurveda, flags } = p;
  const you = viewingOther ? "this member" : "you";
  const nothing = intake.items === 0;
  const perLabel = key === "today" ? "today" : `a day, over ${intake.loggedDays} logged day${intake.loggedDays === 1 ? "" : "s"}`;

  return (
    <div className="grid gap-3">
      {/* Period switch */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#E8E7E0" }} role="tablist" aria-label="Period">
        {periods.map((x) => (
          <button key={x.key} role="tab" aria-selected={x.key === key} onClick={() => setKey(x.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: x.key === key ? "#1C2B1C" : "transparent", color: x.key === key ? "#fff" : C.ink3 }}>
            {x.label}
          </button>
        ))}
      </div>

      {nothing && (
        <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: C.warnSoft, color: "#7A4C12", border: "1px solid #E4B774" }}>
          No meals logged {key === "today" ? "today" : `in the last ${intake.days} days`}.
          {!viewingOther && <> <Link href="/log" className="font-semibold underline">Log a meal</Link> to see your nutrition.</>}
        </div>
      )}

      {/* Energy & macros */}
      {!nothing && (
        <Card title="Energy" aside={<span className="text-xs" style={{ color: C.ink3 }}>{needs.kcal.source}</span>}>
          <p className="text-3xl font-bold tabular-nums" style={{ color: C.ink }}>
            {fmt(intake.perDay.kcal)} <span className="text-base font-medium" style={{ color: C.ink2 }}>kcal {perLabel}</span>
          </p>
          <div className="grid gap-3 mt-3">
            <MeterRow label="Energy" have={intake.perDay.kcal} target={needs.kcal.value} unit="kcal" />
            <MeterRow label="Protein" have={intake.perDay.protein_g} target={needs.protein_g.value} unit="g" />
            <MeterRow label="Carbohydrate" have={intake.perDay.carbs_g} target={needs.carbs_g.value} unit="g" />
            <MeterRow label="Fat" have={intake.perDay.fat_g} target={needs.fat_g.value} unit="g" />
            <MeterRow label="Fibre" have={intake.perDay.fiber_g} target={needs.fiber_g.value} unit="g" />
          </div>
          {intake.estimatedShare > 0.05 && (
            <p className="text-xs mt-3" style={{ color: C.saffron }}>
              {pct(intake.estimatedShare)} of this energy is estimated (Family Dishes awaiting details, or photos of outside food).
            </p>
          )}
        </Card>
      )}

      {/* Lab report → food */}
      <Card title={viewingOther ? "From the lab report" : "From your lab report"}>
        {!hasReport ? (
          <p className="text-sm" style={{ color: C.ink2 }}>
            No lab report yet.
            {!viewingOther && <> Upload one on <Link href="/profile" className="font-semibold underline" style={{ color: C.leaf }}>Profile</Link> to get food guidance based on your results.</>}
          </p>
        ) : flags.length === 0 ? (
          <p className="text-sm" style={{ color: C.leaf }}>All values in the latest report are within the normal range.</p>
        ) : (
          <>
            <p className="text-sm -mt-1 mb-1" style={{ color: C.ink2 }}>
              {flags.length} value{flags.length === 1 ? "" : "s"} outside the normal range, with what {you === "you" ? "you" : "they"} can do through food.
            </p>
            {flags.map((f) => <FlagItem key={f.key} f={f} />)}
            <p className="text-[11px] pt-3" style={{ color: C.ink3, borderTop: `1px solid ${C.rule}` }}>
              General guidance only, not medical advice. Always follow your doctor&apos;s advice, especially about supplements and medicines.
            </p>
          </>
        )}
      </Card>

      {/* Micronutrients */}
      {!nothing && (
        <Card title="Vitamins & minerals" aside={<span className="text-xs" style={{ color: C.ink3 }}>ICMR-NIN 2020</span>}>
          <div className="grid gap-3">
            {MICROS.map((m) => (
              <MeterRow key={m.key} label={m.label} unit={m.unit}
                have={intake.perDay[m.key]} target={needs[m.key].value} limit={needs[m.key].kind === "limit"} />
            ))}
          </div>
          {intake.microCoverage < 0.8 && (
            <p className="text-xs mt-3" style={{ color: C.saffron }}>
              Only {pct(intake.microCoverage)} of the logged food has vitamin and mineral data, so these may read low.
              Completing Family Dishes and logging from the food list helps.
            </p>
          )}
        </Card>
      )}

      {/* Ayurveda */}
      {!nothing && (
        <Card title="Ayurveda" aside={primaryDosha ? <span className="text-xs capitalize" style={{ color: C.saffron }}>{primaryDosha} Prakriti</span> : undefined}>
          {ayurveda.coverage === 0 ? (
            <p className="text-sm" style={{ color: C.ink2 }}>The foods logged don&apos;t have Ayurvedic data yet.</p>
          ) : (
            <div className="grid gap-4">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: C.ink3 }}>Six tastes</p>
                <div className="grid gap-1.5">
                  {(Object.keys(RASA_LABEL) as Rasa[]).map((r) => (
                    <div key={r} className="grid items-center gap-2" style={{ gridTemplateColumns: "76px 1fr 36px" }}>
                      <span className="text-xs" style={{ color: C.ink2 }}>{RASA_LABEL[r]}</span>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.track }}>
                        <div className="h-2 rounded-full" style={{ width: pct(ayurveda.tasteShare[r]), background: ayurveda.tasteShare[r] < 0.03 ? C.low : "#9A7B4F" }} />
                      </div>
                      <span className="text-xs tabular-nums text-right" style={{ color: C.ink3 }}>{pct(ayurveda.tasteShare[r])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: C.ink3 }}>Heating vs cooling</p>
                <div className="flex h-3 rounded-full overflow-hidden" style={{ background: C.track }}>
                  <div style={{ width: pct(ayurveda.virya.heating), background: "#D4573A" }} />
                  <div style={{ width: pct(ayurveda.virya.neutral), background: "#C9C4B5" }} />
                  <div style={{ width: pct(ayurveda.virya.cooling), background: "#5B8DB8" }} />
                </div>
                <div className="flex justify-between text-xs mt-1" style={{ color: C.ink3 }}>
                  <span>Heating {pct(ayurveda.virya.heating)}</span>
                  <span>Neutral {pct(ayurveda.virya.neutral)}</span>
                  <span>Cooling {pct(ayurveda.virya.cooling)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: C.ink3 }}>Effect on each dosha</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["vata", "pitta", "kapha"] as const).map((d) => {
                    const net = ayurveda.doshaNet[d];
                    const mine = ayurveda.primaryDoshas.includes(d);
                    const word = net > 0.15 ? "Balancing" : net < -0.15 ? "Aggravating" : "Neutral";
                    return (
                      <div key={d} className="rounded-xl px-2 py-2 text-center"
                        style={{ background: mine ? C.warnSoft : "#F6F5EE", border: mine ? "1px solid #E4B774" : `1px solid ${C.rule}` }}>
                        <p className="text-xs font-semibold capitalize" style={{ color: C.ink }}>{d}{mine ? " ★" : ""}</p>
                        <p className="text-xs" style={{ color: net < -0.15 ? C.warn : net > 0.15 ? C.leaf : C.ink3 }}>{word}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {ayurveda.notes.length > 0 && (
                <ul className="grid gap-1 text-sm list-disc pl-5" style={{ color: C.ink2 }}>
                  {ayurveda.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Trend */}
      {!nothing && key !== "today" && (
        <Card title="Daily energy" aside={<span className="text-xs" style={{ color: C.ink3 }}>dashed line = target</span>}>
          <Trend daily={intake.daily} target={needs.kcal.value} />
        </Card>
      )}
    </div>
  );
}
