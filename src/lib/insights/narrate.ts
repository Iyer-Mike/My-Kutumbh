import type { IntakeSummary, LabFlag, Needs, NutrientKey } from "./types";
import type { AyurvedaSummary, Rasa } from "./ayurveda";

// One-line plain-language readings of each Insights chart.

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number) => Math.round(x).toLocaleString("en-IN");

const MACROS: [NutrientKey, string][] = [
  ["protein_g", "protein"], ["carbs_g", "carbohydrate"], ["fat_g", "fat"], ["fiber_g", "fibre"],
];
const MICROS: [NutrientKey, string][] = [
  ["iron_mg", "iron"], ["calcium_mg", "calcium"], ["vitamin_b12_mcg", "vitamin B12"],
  ["vitamin_c_mg", "vitamin C"], ["folate_mcg", "folate"], ["potassium_mg", "potassium"],
];

export function energyNarrative(intake: IntakeSummary, needs: Needs): string {
  if (!intake.items) return "No meals logged in this period.";
  const r = needs.kcal.value ? intake.perDay.kcal / needs.kcal.value : 0;
  const level = r > 1.1 ? `${pct(r - 1)} above` : r >= 0.9 ? "on" : `${pct(r)} of`;
  const gaps = MACROS
    .map(([k, name]) => ({ name, r: needs[k].value ? intake.perDay[k] / needs[k].value : 1 }))
    .sort((a, b) => a.r - b.r);
  const gap = gaps[0].r < 0.9 ? ` ${cap(gaps[0].name)} is the biggest gap at ${pct(gaps[0].r)} of need.` : " Protein, carbs, fat and fibre are all close to need.";
  return `Averaging ${num(intake.perDay.kcal)} kcal a day, ${level} your ${num(needs.kcal.value)} kcal target.${gap}`;
}

export function microNarrative(intake: IntakeSummary, needs: Needs): string {
  if (!intake.items) return "No meals logged in this period.";
  const ranked = MICROS
    .map(([k, name]) => ({ name, r: needs[k].value ? intake.perDay[k] / needs[k].value : 1 }))
    .sort((a, b) => a.r - b.r);
  const short = ranked.filter((x) => x.r < 0.9).slice(0, 2);
  const salt = intake.perDay.sodium_mg > needs.sodium_mg.value
    ? ` Sodium is above your ${num(needs.sodium_mg.value)} mg limit.`
    : " Sodium is within your limit.";
  if (!short.length) return `All vitamins and minerals are on track.${salt}`;
  return `Lowest: ${short.map((x) => `${x.name} (${pct(x.r)})`).join(" and ")}.${salt}`;
}

export function trendNarrative(daily: { date: string; kcal: number }[], target: number): string {
  const logged = daily.filter((d) => d.kcal > 0);
  if (!logged.length) return "No meals logged in this period.";
  const top = logged.reduce((a, b) => (b.kcal > a.kcal ? b : a));
  const onTarget = logged.filter((d) => d.kcal >= target * 0.9 && d.kcal <= target * 1.1).length;
  const over = logged.filter((d) => d.kcal > target * 1.1).length;
  const day = new Date(`${top.date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
  const reach = onTarget || over
    ? ` ${onTarget} day${onTarget === 1 ? "" : "s"} near target${over ? `, ${over} above it` : ""}.`
    : ` No day reached your ${num(target)} kcal target.`;
  return `Food logged on ${logged.length} of ${daily.length} days. Highest: ${num(top.kcal)} kcal on ${day}.${reach}`;
}

const RASA_WORD: Record<Rasa, string> = {
  sweet: "Sweet", sour: "Sour", salty: "Salty", pungent: "Pungent", bitter: "Bitter", astringent: "Astringent",
};

export function ayurvedaNarrative(a: AyurvedaSummary): string {
  if (a.coverage === 0) return "The foods logged don't have Ayurvedic data yet.";
  const top = (Object.keys(a.tasteShare) as Rasa[]).reduce((x, y) => (a.tasteShare[y] > a.tasteShare[x] ? y : x));
  const bits = [`${RASA_WORD[top]} leads at ${pct(a.tasteShare[top])}`];
  const worst = a.primaryDoshas
    .map((d) => ({ d, s: a.aggravatingShare[d] }))
    .sort((x, y) => y.s - x.s)[0];
  if (worst && worst.s >= 0.35) bits.push(`${pct(worst.s)} tends to aggravate ${cap(worst.d)}`);
  const lean = a.virya.heating >= 0.5 ? "mostly heating" : a.virya.cooling >= 0.5 ? "mostly cooling" : "a mix of heating and cooling";
  bits.push(`${lean} foods`);
  return `${bits.join("; ")}.`;
}

export function labNarrative(flags: LabFlag[], hasReport: boolean): string {
  if (!hasReport) return "No lab report yet.";
  const known = flags.filter((f) => f.known);
  if (!flags.length) return "All values in the latest report are within the normal range.";
  if (!known.length) return `${flags[0].readings.length} value(s) outside range, with no specific food advice.`;
  const names = known.map((f) => f.label);
  const list = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ").replace(/, ([^,]*)$/, " and $1");
  return `${known.length} area${known.length === 1 ? "" : "s"} to work on through food: ${list}.`;
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
