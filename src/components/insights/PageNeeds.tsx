"use client";

import { useState } from "react";
import type { LabFlag, IntakeSummary, Needs } from "@/lib/insights/types";
import type { Plan, Action } from "@/lib/insights/actions";
import { Card, Label, Chip, Says, C, T, num, qty } from "./bits";

/**
 * 1 · Health Needs Analysis
 *
 * What the blood asks for, what the plate gave, what the two together
 * mean, and what belongs to a doctor rather than a kitchen.
 */

function Change({ a }: { a: Action }) {
  const [why, setWhy] = useState(false);
  const plus = a.kind === "increase";

  return (
    <div className="flex gap-3 items-start py-3" style={{ borderTop: `1px solid #EDE6F7` }}>
      <span
        className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
        style={{
          width: "1.6rem", height: "1.6rem", fontSize: T.body, lineHeight: 1,
          background: plus ? "#E1F0DE" : "#FBE2DC",
          color: plus ? C.leaf : C.warn,
        }}
      >
        {plus ? "+" : "−"}
      </span>
      <div className="min-w-0">
        <p className="m-0" style={{ fontSize: T.say, color: C.ink, lineHeight: 1.45 }}>{a.headline}</p>
        {a.because.length > 0 && (
          <>
            <button onClick={() => setWhy(!why)} className="mt-1 font-medium" style={{ fontSize: T.note, color: C.ink3 }}>
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

export default function PageNeeds({
  plan, flags, intake, needs, hasReport, viewingOther, firstName, onOpenReport,
}: {
  plan: Plan;
  flags: LabFlag[];
  intake: IntakeSummary;
  needs: Needs;
  hasReport: boolean;
  viewingOther: boolean;
  firstName: string;
  onOpenReport: () => void;
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
  const forDoctor = plan.doctor.length;

  return (
    <div className="grid gap-3">

      {/* 1 · Your med report says */}
      <Card>
        <Label n={1} aside={worst.length ? `${worst.length - forDoctor} food-linked · ${forDoctor} for doctor` : undefined}>Your med report says</Label>
        {!hasReport ? (
          <Says>
            No lab report · {viewingOther ? `${firstName} can add one` : "add one"} on Profile
          </Says>
        ) : worst.length === 0 ? (
          <Says>All readings normal ✓</Says>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {worst.map((f) => {
                const r = f.readings[0];
                return r ? (
                  <Chip key={f.key} tone={r.status === "low" ? "low" : "high"}>
                    {r.label} <span className="font-bold">{qty(r.value)}</span>
                  </Chip>
                ) : null;
              })}
            </div>
            <Says>
              <button onClick={onOpenReport} className="font-semibold" style={{ color: C.purple }}>
                The full report ›
              </button>
            </Says>
          </>
        )}
      </Card>

      {/* 2 · What the food intake shows */}
      <Card>
        <Label n={2} aside={`${intake.loggedDays} ${intake.loggedDays === 1 ? "day" : "days"} logged`}>
          What your food intake shows
        </Label>

        <p className="m-0 mt-2 font-bold tabular-nums" style={{ fontSize: T.big, color: C.ink, lineHeight: 1 }}>
          {num(intake.perDay.kcal)}
          <span className="font-medium" style={{ fontSize: T.note, color: C.ink3 }}>
            {" "}of {num(needs.kcal.value)} kcal a day
          </span>
        </p>

        <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: C.track }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(kcalShare * 100, 100)}%`, background: C.purple }} />
        </div>

        {intake.perDay.kcal > 0 && (
          <>
            <div className="flex rounded-lg overflow-hidden mt-3" style={{ height: "1.4rem" }}>
              <div style={{ width: `${carbShare * 100}%`, background: "#C8832A" }} />
              <div style={{ width: `${fatShare * 100}%`, background: "#8B6BC9" }} />
              <div style={{ width: `${protShare * 100}%`, background: C.leaf }} />
              {unaccounted > 0.02 && <div style={{ width: `${unaccounted * 100}%`, background: "#CFC7DD" }} />}
            </div>
            <div className="flex justify-between mt-1.5" style={{ fontSize: T.note, color: C.ink3 }}>
              <span>Carbs {Math.round(carbShare * 100)}%</span>
              <span>Fat {Math.round(fatShare * 100)}%</span>
              <span>Protein {Math.round(protShare * 100)}%</span>
            </div>
            {unaccounted > 0.02 && (
              <p className="m-0 mt-1.5" style={{ fontSize: T.note, color: C.ink3 }}>
                {Math.round(unaccounted * 100)}% of intake is from dishes needing updates.
              </p>
            )}
          </>
        )}
      </Card>

      {/* 3 · The analysis says */}
      <Card>
        <Label n={3} aside={plan.actions.length ? "strongest first" : undefined}>The analysis says</Label>

        {plan.actions.length === 0 ? (
          <Says>Nothing to change ✓</Says>
        ) : (
          <>
            <div className="mt-2">
              {plan.actions.map((a) => <Change key={a.id} a={a} />)}
            </div>
          </>
        )}

        {plan.avoid.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.rule}` }}>
            {plan.avoid.map((a) => (
              <p key={a.id} className="m-0" style={{ fontSize: T.body, color: C.ink }}>
                <span className="font-semibold" style={{ color: C.warn }}>Avoid</span> — {a.headline.replace(/^Logged food that may not suit you:\s*/i, "")}
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* 4 · Ask your doctor */}
      {plan.doctor.length > 0 && (
        <Card tone="gold">
          <Label n={4} tone="gold">Ask your doctor</Label>
          <ul className="grid gap-1.5 mt-2 mb-0 pl-4" style={{ fontSize: T.body, color: C.ink, listStyle: "disc", lineHeight: 1.55 }}>
            {plan.doctor.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <p className="m-0 mt-2" style={{ fontSize: T.note, color: C.ink3 }}>
            Not food-fixable · urgent only if {viewingOther ? `${firstName} feels` : "you feel"} unwell
          </p>
        </Card>
      )}
    </div>
  );
}
