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

/** The member's shortfalls, as the food log shows them. */
function shortfalls(gaps: Gap[]): { label: string; line: string }[] {
  const out: { label: string; line: string }[] = [];
  for (const [key, label] of [["Vitamin B12", "B12"], ["Calcium", "calcium"], ["Iron", "iron"]] as const)
    if (gaps.some((g) => g.label === key)) out.push({ label: key, line: `Low intake of ${label}. Needs fixing.` });
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
  const together = shortfalls(gaps);
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
              <p key={t.label} className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>
                {t.line}
              </p>
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
