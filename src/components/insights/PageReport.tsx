"use client";

import Link from "next/link";
import type { LabFlag } from "@/lib/insights/types";
import type { Gap } from "@/lib/insights/actions";
import { Card, Label, Says, C, T, qty } from "./bits";
import { FAMILY, look } from "@/lib/brand";

/**
 * Reports vs Analysis — one analysis, not a report followed by a second
 * section about it. Each finding carries its own readings, what they
 * mean, what the food log shows about it, and what to eat or go easy on.
 * A shortfall in the food with no lab reading behind it stands as its
 * own finding, marked "not flagged in the report".
 */

/** A shortfall in the food, and the lab finding that bears on the same nutrient. */
const GAPS: { label: string; flag: string; eat: string; plain: string; why?: string }[] = [
  { label: "Vitamin B12", flag: "vitamin_b12", eat: "curd, buttermilk, paneer, milk", plain: "Low B12 intake" },
  { label: "Calcium", flag: "vitamin_d", eat: "curd, milk, paneer, ragi, sesame", plain: "Low calcium intake", why: "low vitamin D means less of it is absorbed" },
  { label: "Iron", flag: "iron", eat: "greens, ragi, dals, with lemon or amla", plain: "Low iron intake" },
];

export default function PageReport({
  flags, gaps, hasReport, doctorNotes, viewingOther, firstName,
}: {
  flags: LabFlag[];
  gaps: Gap[];
  hasReport: boolean;
  doctorNotes: string[];
  viewingOther: boolean;
  firstName: string;
}) {
  const known = flags.filter((f) => f.known);
  const other = flags.filter((f) => !f.known);
  const forDoctor = new Set(["inflammation", "vitamin_d", "kidney", "liver"]);
  const gapFor = (flagKey: string) => {
    const g = GAPS.find((x) => x.flag === flagKey);
    return g && gaps.some((x) => x.label === g.label) ? g : null;
  };
  // Shortfalls with no finding in the report to sit under
  const alone = GAPS.filter((g) => gaps.some((x) => x.label === g.label) && !known.some((f) => f.key === g.flag));

  if (!hasReport && alone.length === 0) {
    return (
      <Card>
        <Label>Reports vs Analysis</Label>
        <Says>
          No lab report · {viewingOther ? `${firstName} can add one` : (
            <>add one on <Link href="/profile" className="font-semibold underline" style={{ color: C.purple }}>Profile</Link></>
          )}
        </Says>
      </Card>
    );
  }

  const nothing = known.length === 0 && alone.length === 0;

  return (
    <div className="grid gap-3">
      {nothing && (
        <Card tone="sky">
          <Label>Reports vs Analysis</Label>
          <Says>All readings normal and every target met ✓</Says>
        </Card>
      )}

      {known.map((f) => {
        const g = gapFor(f.key);
        const foods = f.favourFoods.length ? f.favourFoods.slice(0, 6).join(", ") : (g?.eat ?? null);
        return (
          <Card key={f.key} tone="sky" style={{ padding: "0.75rem 1rem" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="m-0 font-bold" style={{ fontSize: T.say, color: C.ink }}>{f.label}</p>
              {forDoctor.has(f.key) && (
                <span className="font-bold uppercase tracking-wide" style={{ fontSize: T.label, color: C.gold }}>for your doctor</span>
              )}
            </div>

            {/* The readings, inline */}
            <div className="mt-1 grid gap-0.5">
              {f.readings.filter((r) => !r.label.includes("(IFCC)")).map((r) => {
                const ifcc = r.label === "HbA1c" ? f.readings.find((x) => x.label.includes("(IFCC)")) : undefined;
                return (
                  <div key={r.key} className="flex items-baseline justify-between gap-3 tabular-nums" style={{ fontSize: T.note, color: C.ink }}>
                    <span>
                      {r.label}{" "}
                      <span className="font-bold" style={{ color: r.status === "low" ? "#1F4A78" : "#B0302A" }}>
                        {qty(r.value)}{r.unit ? ` ${r.unit}` : ""}{ifcc ? ` (${Math.round(ifcc.value * 10) / 10} ${ifcc.unit})` : ""}
                      </span>
                    </span>
                    <span className="flex-shrink-0" style={{ fontSize: T.label, color: C.ink3 }}>normal {r.range}</span>
                  </div>
                );
              })}
            </div>

            <p className="m-0 mt-1.5" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>{f.meaning}</p>

            {(g || f.intakeNote) && (
              <p className="m-0 mt-1.5" style={{ fontSize: T.body, color: C.ink, lineHeight: 1.5 }}>
                <b>In {viewingOther ? "the" : "your"} food:</b>{" "}
                {f.intakeNote ?? ""}{f.intakeNote && g ? " " : ""}{g ? `${g.plain}${g.why ? `, and ${g.why}` : ""}.` : ""}
              </p>
            )}
            {foods && (
              <p className="m-0 mt-1" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
                <b style={{ color: C.leaf }}>Eat:</b> {foods}.
              </p>
            )}
            {f.limit.length > 0 && (
              <p className="m-0 mt-1" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
                <b style={{ color: C.warn }}>Go easy:</b> {f.limit.slice(0, 3).join("; ").replace(/\.$/, "")}.
              </p>
            )}
          </Card>
        );
      })}

      {/* A shortfall in the food that the report does not mention */}
      {alone.map((g) => (
        <Card key={g.label} tone="mint" style={{ padding: "0.75rem 1rem" }}>
          <p className="m-0 font-bold" style={{ fontSize: T.say, color: C.ink }}>{g.label}</p>
          <p className="m-0 mt-1" style={{ fontSize: T.body, color: C.ink, lineHeight: 1.5 }}>
            <b>In {viewingOther ? "the" : "your"} food:</b> {g.plain}. Not flagged in the report.
          </p>
          <p className="m-0 mt-1" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.5 }}>
            <b style={{ color: C.leaf }}>Eat:</b> {g.eat}.
          </p>
        </Card>
      ))}

      {/* Everything with no food bearing on it */}
      {other.length > 0 && (
        <div className="rounded-2xl px-4 py-3" style={look(FAMILY.violet)}>
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
