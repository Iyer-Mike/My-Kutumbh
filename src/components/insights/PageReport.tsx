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

/** Which of a member's shortfalls the blood has something to say about. */
function pairWithBlood(gaps: Gap[], flags: LabFlag[]): { label: string; line: string }[] {
  const out: { label: string; line: string }[] = [];
  const short = new Map(gaps.map((g) => [g.label, g]));
  const flagged = (k: string) => flags.find((f) => f.key === k);

  const b12 = short.get("Vitamin B12");
  if (b12) {
    const lab = flagged("vitamin_b12");
    out.push({
      label: "Vitamin B12",
      line: lab
        ? "Short in the food and low in the blood. Two signals agreeing — the one to act on first."
        : "Short in the food. The blood has not flagged it yet, which is the easier moment to fix it.",
    });
  }

  const cal = short.get("Calcium");
  if (cal) {
    const d = flagged("vitamin_d");
    out.push({
      label: "Calcium",
      line: d
        ? "Short in the food, and with vitamin D low it is absorbed poorly anyway. Bone is the concern here, not blood."
        : "Short in the food. Bone is rebuilt daily and this is what it is rebuilt from.",
    });
  }

  const iron = short.get("Iron");
  if (iron) {
    const lab = flagged("iron");
    out.push({
      label: "Iron",
      line: lab
        ? "Short in the food and the blood shows it. Greens and ragi, with something sour alongside so it is absorbed."
        : "Short in the food, but the blood counts are normal. Worth improving, not worth worrying about.",
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
  const together = pairWithBlood(gaps, flags);
  const forDoctor = new Set(["inflammation", "vitamin_d", "kidney", "liver"]);

  if (!hasReport) {
    return (
      <Card>
        <Label n={1}>What the report says</Label>
        <Says>
          No lab report yet. {viewingOther ? `${firstName} can add one` : (
            <>Add one on <Link href="/profile" className="font-semibold underline" style={{ color: C.purple }}>Profile</Link></>
          )} and this page will read it in plain words, and set it against what is actually eaten.
        </Says>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">

      {/* 1 · What the report says */}
      <Card>
        <Label n={1} aside={reportDate ? new Date(`${reportDate}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : undefined}>
          What the report says
        </Label>

        {known.length === 0 ? (
          <Says>Every value in this report sits inside its normal range.</Says>
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
                  {f.readings.map((r) => (
                    <Chip key={r.key} tone={r.status === "low" ? "low" : "high"}>
                      {r.label} <span className="font-bold">{r.value}</span>{r.unit ? ` ${r.unit}` : ""}
                    </Chip>
                  ))}
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
          <p className="m-0 mt-1" style={{ fontSize: T.note, color: C.ink3 }}>
            The blood and the plate read together — one tells what the other cannot.
          </p>
          <div className="mt-2 grid gap-2.5">
            {together.map((t) => (
              <p key={t.label} className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>
                <span className="font-bold" style={{ color: C.ink }}>{t.label}</span> — {t.line}
              </p>
            ))}
          </div>
          <button onClick={onOpenIntake} className="mt-3 font-semibold" style={{ fontSize: T.note, color: C.purple }}>
            The numbers behind these ›
          </button>
        </Card>
      )}

      {/* Everything with no food bearing on it */}
      {other.length > 0 && (
        <div className="rounded-2xl px-4 py-3" style={{ background: "#F3EEFA", border: `1px dashed #D6C9EA` }}>
          <p className="m-0" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
            {other.reduce((n, f) => n + f.readings.length, 0)} other{" "}
            {other.reduce((n, f) => n + f.readings.length, 0) === 1 ? "reading is" : "readings are"} outside range with no
            food advice attached — {other.flatMap((f) => f.readings.map((r) => `${r.label} ${qty(r.value)}`)).slice(0, 3).join(", ")}.
            Worth asking about at your next visit.
          </p>
        </div>
      )}

      {doctorNotes.length > 0 && (
        <p className="m-0 px-1" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
          General guidance, not medical advice. Always follow your doctor, especially about medicines and supplements.
        </p>
      )}
    </div>
  );
}
