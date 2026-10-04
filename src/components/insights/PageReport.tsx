"use client";

import Link from "next/link";
import type { LabFlag } from "@/lib/insights/types";
import type { Gap } from "@/lib/insights/actions";
import { Card, Label, Chip, Says, C, T, qty } from "./bits";

/**
 * 3 · Your Lab Report
 *
 * The readings and what they mean — and then the one thing neither the
 * report nor the food log can say alone: what the two show together.
 * The nutrient numbers themselves live on Intake; repeating them here
 * is how this page became a second sermon the first time round.
 */

/** The member's shortfalls in what was eaten, set beside what the lab report says about the same nutrient. */
function shortfalls(gaps: Gap[], flags: LabFlag[]): { label: string; head: string; eat: string }[] {
  const out: { label: string; head: string; eat: string }[] = [];
  const lab = (key: string) => flags.find((f) => f.key === key)?.readings[0];
  const reading = (r: { label: string; value: number; unit: string; status: string }) =>
    `${r.label} ${qty(r.value)}${r.unit ? ` ${r.unit}` : ""} (${r.status})`;
  const has = (label: string) => gaps.some((g) => g.label === label);

  if (has("Vitamin B12")) {
    const r = lab("vitamin_b12");
    out.push({
      label: "Vitamin B12",
      head: `Low B12 intake · Lab report: ${r ? reading(r) : "not flagged"}`,
      eat: "Eat: curd, buttermilk, paneer, milk.",
    });
  }
  if (has("Calcium")) {
    const r = lab("vitamin_d");
    out.push({
      label: "Calcium",
      head: `Low calcium intake · Lab report: ${r ? `${reading(r)}, so less is absorbed` : "not flagged"}`,
      eat: "Eat: curd, milk, paneer, ragi, sesame.",
    });
  }
  if (has("Iron")) {
    const r = lab("iron");
    out.push({
      label: "Iron",
      head: `Low iron intake · Lab report: ${r ? reading(r) : "not flagged"}`,
      eat: "Eat: greens, ragi, dals, with lemon or amla.",
    });
  }
  return out;
}

export default function PageReport({
  flags, gaps, hasReport, reportDate, doctorNotes, viewingOther, firstName, onOpenIntake,
}: {
  flags: LabFlag[];
  gaps: Gap[];
  hasReport: boolean;
  reportDate: string | null;
  doctorNotes: string[];
  viewingOther: boolean;
  firstName: string;
  onOpenIntake: () => void;
}) {
  const known = flags.filter((f) => f.known);
  const other = flags.filter((f) => !f.known);
  const together = shortfalls(gaps, flags);
  const forDoctor = new Set(["inflammation", "vitamin_d", "kidney", "liver"]);

  if (!hasReport) {
    return (
      <Card>
        <Label n={1}>What the report says</Label>
        <Says>
          No lab report · {viewingOther ? `${firstName} can add one` : (
            <>add one on <Link href="/profile" className="font-semibold underline" style={{ color: C.purple }}>Profile</Link></>
          )}
        </Says>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">

      {/* 1 · What the report says */}
      <Card>
        <Label n={1}>
          What the report says
        </Label>

        {known.length === 0 ? (
          <Says>All readings normal ✓</Says>
        ) : (
          <div className="mt-2 grid gap-3">
            {known.map((f, i) => (
              <div key={f.key} style={i ? { borderTop: `1px solid #EDE6F7`, paddingTop: "0.75rem" } : undefined}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="m-0 font-bold" style={{ fontSize: T.say, color: C.ink }}>{f.label}</p>
                  {forDoctor.has(f.key) && (
                    <span className="font-bold uppercase tracking-wide" style={{ fontSize: T.label, color: C.gold }}>
                      for your doctor
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {f.readings.filter((r) => !r.label.includes("(IFCC)")).map((r) => {
                    const ifcc = r.label === "HbA1c" ? f.readings.find((x) => x.label.includes("(IFCC)")) : undefined;
                    return (
                      <Chip key={r.key} tone={r.status === "low" ? "low" : "high"}>
                        {r.label} <span className="font-bold">{r.value}</span>{r.unit ? ` ${r.unit}` : ""}
                        {ifcc ? ` (${Math.round(ifcc.value * 10) / 10} ${ifcc.unit})` : ""}
                        {f.key === "lipids" ? ` (normal ${r.range})` : ""}
                      </Chip>
                    );
                  })}
                </div>

                <p className="m-0 mt-2" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>{f.meaning}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2 · What the food adds to this */}
      {together.length > 0 && (
        <Card>
          <Label n={2}>What {viewingOther ? "the" : "your"} food adds to this</Label>
          <div className="mt-2 grid gap-2.5">
            {together.map((t) => (
              <div key={t.label}>
                <p className="m-0 font-bold" style={{ fontSize: T.body, color: C.ink, lineHeight: 1.5 }}>{t.head}</p>
                <p className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>{t.eat}</p>
              </div>
            ))}
          </div>
          <button onClick={onOpenIntake} className="mt-3 font-semibold" style={{ fontSize: T.note, color: C.purple }}>
            Numbers ›
          </button>
        </Card>
      )}

      {/* Everything with no food bearing on it */}
      {other.length > 0 && (
        <div className="rounded-2xl px-4 py-3" style={{ background: "#F3EEFA", border: `1px dashed #D6C9EA` }}>
          <p className="m-0" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
            {other.reduce((n, f) => n + f.readings.length, 0)} more outside range, no food advice:{" "}
            {other.flatMap((f) => f.readings.map((r) => `${r.label} ${qty(r.value)}`)).slice(0, 3).join(", ")} → ask your doctor
          </p>
        </div>
      )}

      {doctorNotes.length > 0 && (
        <p className="m-0 px-1" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
          Guidance only, not medical advice · follow your doctor on medicines and supplements
        </p>
      )}
    </div>
  );
}
