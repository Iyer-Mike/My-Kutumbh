import type { Needs, Profile, Target } from "./types";

// Daily targets for Indian adults, based on ICMR-NIN "Nutrient Requirements
// for Indians" (2020). Approximate, for tracking trends — not clinical advice.

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export function ageOn(dob: string | null, today: string): number | null {
  if (!dob) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !ty) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Mifflin–St Jeor resting energy × activity factor, unless a goal is set. */
export function kcalTarget(p: Profile, today: string): Target {
  if (p.daily_kcal_goal && p.daily_kcal_goal > 0) {
    return { value: Math.round(p.daily_kcal_goal), kind: "goal", source: "your daily goal" };
  }
  const age = ageOn(p.date_of_birth, today);
  const complete = !!(p.weight_kg && p.height_cm && age != null && p.activity_level);
  const w = p.weight_kg ?? 60;
  const h = p.height_cm ?? 160;
  const a = age ?? 40;
  const sexTerm = p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * a + sexTerm;
  const factor = ACTIVITY_FACTOR[p.activity_level ?? ""] ?? 1.375;
  return {
    value: Math.round((bmr * factor) / 10) * 10,
    kind: "goal",
    source: complete ? "estimated from your profile" : "rough estimate — complete your profile for accuracy",
  };
}

export function computeNeeds(p: Profile, today: string): Needs {
  const kcal = kcalTarget(p, today);
  const age = ageOn(p.date_of_birth, today) ?? 40;
  const male = p.gender === "male";
  const female = p.gender === "female";
  const w = p.weight_kg ?? 60;
  const src = "ICMR-NIN 2020";
  const g = (value: number, source = src): Target => ({ value, kind: "goal", source });

  return {
    kcal,
    protein_g:       g(Math.round(0.83 * w), `${src} · 0.83 g per kg`),
    carbs_g:         g(Math.round((kcal.value * 0.55) / 4), "about 55% of energy"),
    fat_g:           g(Math.round((kcal.value * 0.25) / 9), "about 25% of energy"),
    fiber_g:         g(Math.round((kcal.value / 1000) * 15), "15 g per 1000 kcal"),
    // Where sex is unknown, use the higher requirement so needs are covered.
    iron_mg:         g(female ? (age >= 50 ? 19 : 29) : male ? 19 : 29),
    calcium_mg:      g(female && age >= 50 ? 1200 : 1000),
    vitamin_b12_mcg: g(2.5),
    vitamin_c_mg:    g(male ? 80 : female ? 65 : 80),
    folate_mcg:      g(male ? 300 : female ? 220 : 300),
    sodium_mg:       { value: 2000, kind: "limit", source: "about 5 g salt a day" },
    potassium_mg:    g(3500),
  };
}
