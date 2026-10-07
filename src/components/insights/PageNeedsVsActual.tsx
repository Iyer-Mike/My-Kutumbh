"use client";

import { useState } from "react";
import Link from "next/link";
import type { LabFlag, IntakeSummary, Needs, Profile } from "@/lib/insights/types";
import type { Plan, Action, Gap } from "@/lib/insights/actions";
import { Card, Label, Bar, Says, C, T, num, qty } from "./bits";
import { FAMILY, look } from "@/lib/brand";

/**
 * Needs vs Actual — one page, in the order it is read:
 *   what the blood says | what the profile asks for (side by side)
 *   what the food gave
 *   where it falls short
 *   what to change
 *   what is for a doctor, and why the targets are what they are
 */

function Change({ a }: { a: Action }) {
  const [why, setWhy] = useState(false);
  const plus = a.kind === "increase";

  return (
    <div className="flex gap-2 items-start py-1.5" style={{ borderTop: `1px solid #EDE6F7` }}>
      <span
        className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
        style={{
          width: "1.4rem", height: "1.4rem", fontSize: T.body, lineHeight: 1,
          background: plus ? "#E1F0DE" : "#FBE2DC",
          color: plus ? C.leaf : C.warn,
        }}
      >
        {plus ? "+" : "−"}
      </span>
      <div className="min-w-0">
        <p className="m-0" style={{ fontSize: T.say, color: C.ink, lineHeight: 1.3 }}>{a.headline}</p>
        {a.because.length > 0 && (
          <>
            <button onClick={() => setWhy(!why)} className="font-medium" style={{ fontSize: T.note, color: C.ink3 }}>
              {why ? "Hide why" : `Why · ${a.because.length}`}
            </button>
            {why && (
              <ul className="mt-1 mb-0 pl-4 grid gap-1" style={{ fontSize: T.note, color: C.ink3, listStyle: "disc" }}>
                {a.because.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Why a target is what it is — for this member, not in general. */
function reasonFor(label: string, p: Profile, vitDLow: boolean, age: number | null): string | null {
  const has = (re: RegExp) => (p.conditions ?? []).some((c) => re.test(c));

  switch (label) {
    case "Fibre":
      return has(/diabet/i)
        ? "Raised for diabetes: fibre slows sugar entering the blood (lowers HbA1c)."
        : "Steadies digestion and blood sugar; most diets fall short.";
    case "Protein":
      return age && age >= 65
        ? "0.8 g per kg body weight. After 65, muscle loss speeds up; protein slows it."
        : "0.8 g per kg body weight; keeps muscle, repairs tissue.";
    case "Calcium":
      return vitDLow
        ? "Low vitamin D reduces calcium absorption; fix both."
        : "Bones are rebuilt at every age and need it daily.";
    case "Vitamin B12":
      return p.diet_type && /veg/i.test(p.diet_type)
        ? "Scarce in vegetarian food, absorbed less with age. Milk and curd daily, or a doctor-approved supplement."
        : "Needed for nerves and blood; absorbed less with age.";
    case "Iron":
      return "Carries oxygen. Vegetarian iron absorbs poorly unless eaten with something sour.";
    case "Potassium":
      return "Balances salt, eases blood pressure. Comes from fruit and vegetables.";
    case "Salt":
      return has(/hypertens|pressure/i)
        ? "Capped lower for blood pressure. Most hides in pickles, papad, packet snacks."
        : "Most households exceed the cap via pickles, papad, packet food.";
    default:
      return null;
  }
}


export default function PageNeedsVsActual({
  plan, flags, gaps, intake, needs, profile, age, vitDLow, hasReport, viewingOther, firstName, onOpenReport, dishesToComplete,
}: {
  plan: Plan;
  flags: LabFlag[];
  gaps: Gap[];
  intake: IntakeSummary;
  needs: Needs;
  profile: Profile;
  age: number | null;
  vitDLow: boolean;
  hasReport: boolean;
  viewingOther: boolean;
  firstName: string;
  onOpenReport: () => void;
  dishesToComplete: number;
}) {
  const kcalShare = needs.kcal.value ? intake.perDay.kcal / needs.kcal.value : 0;
  // Each from its own grams. They need not sum to one: some logged food
  // has no breakdown, and pretending otherwise is how protein came to
  // read 31% when the truth was nearer 9%.
  const kcal = intake.perDay.kcal || 1;
  const carbShare = (intake.perDay.carbs_g * 4) / kcal;
  const fatShare = (intake.perDay.fat_g * 9) / kcal;
  const protShare = (intake.perDay.protein_g * 4) / kcal;
  const unaccounted = Math.max(0, 1 - carbShare - fatShare - protShare);

  const worst = flags.filter((f) => f.known).slice(0, 5);
  const facts = [
    age ? `${age} yrs` : null,
    profile.gender,
    profile.height_cm ? `${profile.height_cm} cm` : null,
    profile.weight_kg ? `${profile.weight_kg} kg` : null,
  ].filter(Boolean).join(" · ");
  const reasoned = gaps.slice(0, 4).map((g) => ({ g, why: reasonFor(g.label, profile, vitDLow, age) })).filter((x) => x.why);
  const tags = [...(profile.conditions ?? []), ...(profile.allergies ?? []).map((a) => `allergy: ${a}`)];

  // One line of a small vertical list: the name, then its value, right-aligned
  const line = (k: string, v: string, tone?: string) => (
    <div key={k} className="flex items-baseline justify-between gap-2 py-1" style={{ borderTop: `1px solid ${C.rule}` }}>
      <span style={{ fontSize: T.note, color: C.ink2 }}>{k}</span>
      <span className="font-bold tabular-nums" style={{ fontSize: T.note, color: tone ?? C.ink }}>{v}</span>
    </div>
  );

  return (
    <div className="grid gap-3">

      {/* Blood and profile, side by side */}
      <div className="grid grid-cols-2 gap-2">
        <Card style={{ padding: "0.75rem" }}>
          <Label>Your med report says</Label>
          {!hasReport ? (
            <Says>No lab report · {viewingOther ? `${firstName} can add one` : "add one"} on Profile</Says>
          ) : worst.length === 0 ? (
            <Says>All readings normal ✓</Says>
          ) : (
            <div className="mt-1.5">
              {worst.map((f) => {
                const r = f.readings[0];
                return r ? line(r.label, String(qty(r.value)), r.status === "low" ? "#1F4A78" : "#9A2C1B") : null;
              })}
              <button onClick={onOpenReport} className="mt-1.5 font-semibold" style={{ fontSize: T.note, color: C.purple }}>
                Full report ›
              </button>
            </div>
          )}
        </Card>

        <Card style={{ padding: "0.75rem" }}>
          <Label>Your profile targets</Label>
          {facts && <p className="m-0 mt-1" style={{ fontSize: T.label, color: C.ink3, lineHeight: 1.4 }}>{facts}</p>}
          <div className="mt-1">
            {line("Energy", `${num(needs.kcal.value)} kcal`)}
            {line("Protein", `${Math.round(needs.protein_g.value)} g`)}
            {line("Fibre", `${Math.round(needs.fiber_g.value)} g`)}
            {line("Salt max", `${(needs.sodium_mg.value / 1000).toFixed(1)} g`)}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded-full"
                  style={{ fontSize: T.label, background: t.startsWith("allergy") ? "#FBE2DC" : "#FBEBCB", color: t.startsWith("allergy") ? "#9A2C1B" : "#7E4A08" }}>{t}</span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* What the food gave */}
      <Card style={{ padding: "0.75rem 1rem" }}>
        <Label aside={`${intake.loggedDays} ${intake.loggedDays === 1 ? "day" : "days"} logged`}>What your food intake shows</Label>
        <p className="m-0 mt-1 font-bold tabular-nums" style={{ fontSize: "1.5rem", color: C.ink, lineHeight: 1.1 }}>
          {num(intake.perDay.kcal)}
          <span className="font-medium" style={{ fontSize: T.note, color: C.ink3 }}> of {num(needs.kcal.value)} kcal a day</span>
        </p>
        <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: C.track }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(kcalShare * 100, 100)}%`, background: C.purple }} />
        </div>
        {intake.perDay.kcal > 0 && (
          <>
            <div className="flex rounded-md overflow-hidden mt-2" style={{ height: "1rem" }}>
              <div style={{ width: `${carbShare * 100}%`, background: "#C8832A" }} />
              <div style={{ width: `${fatShare * 100}%`, background: "#8B6BC9" }} />
              <div style={{ width: `${protShare * 100}%`, background: C.leaf }} />
              {unaccounted > 0.02 && <div style={{ width: `${unaccounted * 100}%`, background: "#CFC7DD" }} />}
            </div>
            <div className="flex justify-between mt-1" style={{ fontSize: T.label, color: C.ink3 }}>
              <span>Carbs {Math.round(carbShare * 100)}%</span>
              <span>Fat {Math.round(fatShare * 100)}%</span>
              <span>Protein {Math.round(protShare * 100)}%</span>
            </div>
            {unaccounted > 0.02 && (
              <p className="m-0 mt-1" style={{ fontSize: T.label, color: C.ink3 }}>
                Energy estimate incomplete: some dishes lack food values.
                {dishesToComplete > 0 && !viewingOther && (
                  <> <Link href="/family/dishes" className="font-semibold underline" style={{ color: C.purple }}>Complete the dishes</Link></>
                )}
              </p>
            )}
          </>
        )}
      </Card>

      {/* Where it falls short */}
      <Card style={{ padding: "0.75rem 1rem" }}>
        <Label aside={gaps.length ? `${gaps.length} short` : "all met"}>Food intake analysis</Label>
        {gaps.length === 0 ? (
          <Says>All targets met ✓</Says>
        ) : (
          <div className="mt-1">
            {gaps.map((g) => (
              <div key={g.label} className="py-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: T.note, color: C.ink }}>{g.label}</span>
                  <span className="tabular-nums flex-shrink-0" style={{ fontSize: T.label, color: C.ink3 }}>
                    {qty(g.had)} / {qty(g.target)} {g.unit}
                  </span>
                </div>
                <Bar share={g.share} tone={g.share < 0.6 ? "bad" : g.share < 0.85 ? "near" : "good"} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* What to change */}
      <Card>
        <Label aside={plan.actions.length ? "strongest first" : undefined}>The analysis says</Label>
        {plan.actions.length === 0 ? (
          <Says>Nothing to change ✓</Says>
        ) : (
          <div className="mt-1">
            {plan.actions.map((a) => <Change key={a.id} a={a} />)}
          </div>
        )}
        {plan.avoid.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.rule}` }}>
            {plan.avoid.map((a) => (
              <p key={a.id} className="m-0" style={{ fontSize: T.body, color: C.ink }}>
                <span className="font-semibold" style={{ color: C.warn }}>Avoid</span> — {a.headline.replace(/^Logged food that may not suit you:\s*/i, "")}
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* For a doctor, and why the targets are what they are: one box */}
      {(plan.doctor.length > 0 || reasoned.length > 0) && (
        <Card tone={plan.doctor.length ? "gold" : "plain"}>
          {plan.doctor.length > 0 && (
            <>
              <Label tone="gold">Ask your doctor</Label>
              <ul className="grid gap-1 mt-1.5 mb-0 pl-4" style={{ fontSize: T.body, color: C.ink, listStyle: "disc", lineHeight: 1.5 }}>
                {plan.doctor.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <p className="m-0 mt-1.5" style={{ fontSize: T.note, color: C.ink3 }}>
                Not food-fixable · urgent only if {viewingOther ? `${firstName} feels` : "you feel"} unwell
              </p>
            </>
          )}
          {reasoned.length > 0 && (
            <div className={plan.doctor.length ? "mt-3 pt-3" : ""} style={plan.doctor.length ? { borderTop: `1px solid ${C.goldRule}` } : undefined}>
              <Label tone={plan.doctor.length ? "gold" : "plain"}>Why these targets</Label>
              <div className="mt-1.5 grid gap-2">
                {reasoned.map(({ g, why }) => (
                  <p key={g.label} className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
                    <span className="font-bold" style={{ color: C.ink }}>{g.label} {qty(g.target)} {g.unit}</span>{" — "}{why}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
