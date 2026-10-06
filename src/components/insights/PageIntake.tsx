"use client";

import Link from "next/link";
import type { IntakeSummary, Needs, Profile } from "@/lib/insights/types";
import type { Gap } from "@/lib/insights/actions";
import { Card, Label, Bar, Says, C, T, num, qty } from "./bits";
import { FAMILY, look } from "@/lib/brand";

/**
 * 2 · Food Intake Analysis
 *
 * What this person's own body asks for, what the food gave, why those
 * numbers are theirs in particular, and how honest the logging is.
 */

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

export default function PageIntake({
  gaps, intake, needs, profile, age, vitDLow, dishesToComplete, viewingOther, firstName,
}: {
  gaps: Gap[];
  intake: IntakeSummary;
  needs: Needs;
  profile: Profile;
  /** Worked out on the server, where the day is already known. */
  age: number | null;
  vitDLow: boolean;
  dishesToComplete: number;
  viewingOther: boolean;
  firstName: string;
}) {
  const facts = [
    age ? `${age} years` : null,
    profile.gender,
    profile.height_cm ? `${profile.height_cm} cm` : null,
    profile.weight_kg ? `${profile.weight_kg} kg` : null,
    profile.activity_level ? `${profile.activity_level} activity` : null,
    profile.diet_type,
  ].filter(Boolean).join(" · ");

  const reasoned = gaps.slice(0, 4).map((g) => ({ g, why: reasonFor(g.label, profile, vitDLow, age) })).filter((x) => x.why);

  return (
    <div className="grid gap-3">

      {/* 1 · Your profile targets */}
      <Card>
        <Label n={1}>Your profile targets</Label>
        <p className="m-0 mt-2" style={{ fontSize: T.body, color: C.ink, lineHeight: 1.5 }}>{facts || "Profile incomplete"}</p>

        {((profile.conditions ?? []).length > 0 || (profile.allergies ?? []).length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(profile.conditions ?? []).map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full" style={{ fontSize: T.note, background: "#FBEBCB", color: "#7E4A08" }}>{c}</span>
            ))}
            {(profile.allergies ?? []).map((a) => (
              <span key={a} className="px-2 py-0.5 rounded-full" style={{ fontSize: T.note, background: "#FBE2DC", color: "#9A2C1B" }}>allergy: {a}</span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {[
            { v: num(needs.kcal.value), k: "kcal" },
            { v: `${Math.round(needs.protein_g.value)} g`, k: "protein" },
            { v: `${Math.round(needs.fiber_g.value)} g`, k: "fibre" },
            { v: `${(needs.sodium_mg.value / 1000).toFixed(1)} g`, k: "salt max" },
          ].map((t) => (
            <div key={t.k} className="flex-1 rounded-xl px-2 py-2 text-center" style={look(FAMILY.violet)}>
              <p className="m-0 font-bold tabular-nums" style={{ fontSize: T.say, color: C.ink }}>{t.v}</p>
              <p className="m-0 mt-0.5" style={{ fontSize: T.label, color: C.ink3 }}>{t.k}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 2 · Food intake analysis */}
      <Card>
        <Label n={2} aside={gaps.length ? `${gaps.length} short` : "all met"}>Food intake analysis</Label>

        {gaps.length === 0 ? (
          <Says>All targets met ✓</Says>
        ) : (
          <div className="mt-2">
            {gaps.map((g) => (
              <div key={g.label} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: T.body, color: C.ink }}>{g.label}</span>
                  <span className="tabular-nums flex-shrink-0" style={{ fontSize: T.note, color: C.ink3 }}>
                    {qty(g.had)} / {qty(g.target)} {g.unit}
                  </span>
                </div>
                <Bar share={g.share} tone={g.share < 0.6 ? "bad" : g.share < 0.85 ? "near" : "good"} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3 · Know your requirements */}
      {reasoned.length > 0 && (
        <Card>
          <Label n={3}>Why these targets</Label>
          <div className="mt-2 grid gap-2.5">
            {reasoned.map(({ g, why }) => (
              <p key={g.label} className="m-0" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>
                <span className="font-bold" style={{ color: C.ink }}>
                  {g.label} {qty(g.target)} {g.unit}
                </span>{" — "}{why}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* 4 · About the logging */}
      <Card tone="gold">
        <Label n={4} tone="gold">About {viewingOther ? "the" : "your"} logging</Label>

        <div className="flex gap-2 mt-2">
          <div className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "#FFF7E6" }}>
            <p className="m-0 font-bold tabular-nums" style={{ fontSize: T.say, color: C.ink }}>
              {intake.loggedDays}<span style={{ fontSize: T.note, color: C.ink3 }}>/{intake.days}</span>
            </p>
            <p className="m-0 mt-0.5" style={{ fontSize: T.label, color: C.ink3 }}>days</p>
          </div>
          <div className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "#FFF7E6" }}>
            <p className="m-0 font-bold tabular-nums" style={{ fontSize: T.say, color: C.ink }}>{intake.items}</p>
            <p className="m-0 mt-0.5" style={{ fontSize: T.label, color: C.ink3 }}>items</p>
          </div>
          <div className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "#FFF7E6" }}>
            <p className="m-0 font-bold tabular-nums" style={{ fontSize: T.say, color: intake.estimatedShare > 0.05 ? C.gold : C.ink }}>
              {Math.round(intake.estimatedShare * 100)}<span style={{ fontSize: T.note }}>%</span>
            </p>
            <p className="m-0 mt-0.5" style={{ fontSize: T.label, color: C.ink3 }}>estimated</p>
          </div>
        </div>

        {intake.loggedDays < intake.days && (
          <p className="m-0 mt-3" style={{ fontSize: T.body, color: C.ink, lineHeight: 1.55 }}>
            {intake.days - intake.loggedDays} {intake.days - intake.loggedDays === 1 ? "day" : "days"} not logged · averages read low
          </p>
        )}

        {intake.estimatedShare > 0.05 && dishesToComplete > 0 && (
          <p className="m-0 mt-2" style={{ fontSize: T.note, color: C.ink3, lineHeight: 1.5 }}>
            {dishesToComplete} {dishesToComplete === 1 ? "dish needs" : "dishes need"} ingredients
          </p>
        )}

        {dishesToComplete > 0 && !viewingOther && (
          <Link
            href="/family/dishes"
            className="inline-block mt-3 font-semibold rounded-full px-4 py-2"
            style={{ fontSize: T.note, background: "#E7DCF7", color: C.purple }}
          >
            Complete the dishes
          </Link>
        )}
      </Card>
    </div>
  );
}
