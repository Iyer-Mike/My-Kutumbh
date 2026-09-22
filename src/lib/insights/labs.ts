import type { FoodData, IntakeSummary, LabFlag, Needs, NutrientKey } from "./types";

// General dietary guidance for common lab findings in Indian adults.
// Guidance only — the app always tells people to confirm with their doctor.

export type LabRange = { low?: number; high?: number };
type Guidance = {
  meaning: string;
  favour: string[];
  limit: string[];
  nutrient: NutrientKey | null;
  direction: "more" | "less";
};
type Rule = { label: string; unit: string; range: LabRange; low?: Guidance; high?: Guidance };

const IRON: Guidance = {
  meaning: "Low iron can cause tiredness and anaemia.",
  favour: [
    "Iron-rich foods: leafy greens, dals, chana, rajma, poha, dates",
    "Pair them with vitamin C (amla, guava, lemon) to absorb more iron",
  ],
  limit: ["Tea or coffee within an hour of meals — it blocks iron absorption"],
  nutrient: "iron_mg", direction: "more",
};

const SUGAR: Guidance = {
  meaning: "Your blood sugar is above the healthy range.",
  favour: [
    "Millets and whole grains in place of some white rice and maida",
    "Dal, vegetables and fibre with every meal",
    "Protein at breakfast — curd, sprouts, dal",
  ],
  limit: ["Sweets, sugar and sweetened drinks", "Large portions of white rice or rice-heavy tiffin"],
  nutrient: "fiber_g", direction: "more",
};

const LIPIDS: Guidance = {
  meaning: "Your blood fats are above the healthy range, which raises heart risk.",
  favour: ["Fibre: oats, dals, vegetables and fruit", "Cooking with less oil; nuts in small portions"],
  limit: ["Fried snacks like vada and murukku", "Ghee and butter in large amounts", "Sweets and refined flour"],
  nutrient: "fiber_g", direction: "more",
};

const KIDNEY: Guidance = {
  meaning: "This kidney marker is raised.",
  favour: ["Moderate, balanced portions", "Enough water, unless your doctor has limited fluids"],
  limit: ["Extra salt, pickles, papad and salty snacks", "Very high-protein diets unless advised"],
  nutrient: "sodium_mg", direction: "less",
};

const LIVER: Guidance = {
  meaning: "Raised liver enzymes can signal strain on the liver.",
  favour: ["Vegetables, fruit and whole grains"],
  limit: ["Fried and very oily food", "Sugar and sweets", "Alcohol"],
  nutrient: null, direction: "less",
};

export const LAB_RULES: Record<string, Rule> = {
  hemoglobin: { label: "Haemoglobin", unit: "g/dL", range: { low: 12, high: 17 }, low: { ...IRON, meaning: "Low haemoglobin can mean iron-deficiency anaemia." } },
  iron:       { label: "Iron", unit: "μg/dL", range: { low: 60, high: 170 }, low: IRON },
  ferritin:   {
    label: "Ferritin", unit: "ng/mL", range: { low: 20, high: 300 },
    low: { ...IRON, meaning: "Low ferritin means your iron stores are running low." },
    high: { meaning: "High ferritin can reflect inflammation or too much iron.", favour: [], limit: ["Iron supplements unless prescribed"], nutrient: null, direction: "less" },
  },
  vitamin_b12: {
    label: "Vitamin B12", unit: "pg/mL", range: { low: 211, high: 911 },
    low: {
      meaning: "Low B12 affects energy, nerves and blood; it's common on vegetarian diets.",
      favour: ["Dairy every day: curd, buttermilk, paneer, milk", "Ask your doctor about a B12 supplement — vegetarian food alone often isn't enough"],
      limit: [], nutrient: "vitamin_b12_mcg", direction: "more",
    },
  },
  vitamin_d: {
    label: "Vitamin D", unit: "ng/mL", range: { low: 30, high: 100 },
    low: {
      meaning: "Low vitamin D weakens bones and immunity.",
      favour: ["15–20 minutes of morning sun on arms and face", "Vitamin D–fortified milk or curd", "Ask your doctor about a supplement — food alone rarely corrects a deficiency"],
      limit: [], nutrient: null, direction: "more",
    },
  },
  folate: {
    label: "Folate", unit: "ng/mL", range: { low: 4 },
    low: { meaning: "Low folate can cause anaemia and tiredness.", favour: ["Leafy greens, dals, chickpeas, sprouts"], limit: [], nutrient: "folate_mcg", direction: "more" },
  },
  calcium: {
    label: "Calcium", unit: "mg/dL", range: { low: 8.5, high: 10.5 },
    low: { meaning: "Low calcium affects bones and muscles.", favour: ["Curd, milk, paneer, ragi, sesame"], limit: [], nutrient: "calcium_mg", direction: "more" },
  },
  hba1c: {
    label: "HbA1c", unit: "%", range: { high: 5.6 },
    high: { ...SUGAR, meaning: "HbA1c is your 3-month average blood sugar. 5.7–6.4% is prediabetes; 6.5% or more is diabetes." },
  },
  fasting_glucose:      { label: "Fasting glucose", unit: "mg/dL", range: { low: 70, high: 99 }, high: SUGAR },
  postprandial_glucose: { label: "Post-meal glucose", unit: "mg/dL", range: { high: 140 }, high: SUGAR },
  total_cholesterol:    { label: "Total cholesterol", unit: "mg/dL", range: { high: 200 }, high: LIPIDS },
  ldl:                  { label: "LDL cholesterol", unit: "mg/dL", range: { high: 100 }, high: LIPIDS },
  triglycerides:        {
    label: "Triglycerides", unit: "mg/dL", range: { high: 150 },
    high: { ...LIPIDS, meaning: "High triglycerides are driven most by sugar and refined carbs.", limit: ["Sweets, sugar and sweetened drinks", "White rice and maida in large portions", "Fried snacks"] },
  },
  hdl: {
    label: "HDL cholesterol", unit: "mg/dL", range: { low: 40 },
    low: { meaning: "Low HDL (the protective cholesterol) raises heart risk.", favour: ["Daily physical activity", "Nuts and seeds in small portions"], limit: ["Refined carbs and sweets"], nutrient: null, direction: "more" },
  },
  tsh: {
    label: "TSH", unit: "mIU/L", range: { low: 0.4, high: 4.5 },
    high: {
      meaning: "High TSH can mean an underactive thyroid.",
      favour: ["Take thyroid medicine on an empty stomach, 30–60 minutes before food", "Iodised salt in normal amounts"],
      limit: ["Calcium- or iron-rich foods and tea within 4 hours of thyroid medicine"],
      nutrient: null, direction: "less",
    },
    low: { meaning: "Low TSH can mean an overactive thyroid. Please discuss with your doctor.", favour: [], limit: [], nutrient: null, direction: "less" },
  },
  uric_acid: {
    label: "Uric acid", unit: "mg/dL", range: { high: 7 },
    high: { meaning: "High uric acid can lead to gout.", favour: ["Plenty of water", "Fruit and low-fat dairy"], limit: ["Sugary drinks", "Alcohol"], nutrient: null, direction: "less" },
  },
  creatinine: { label: "Creatinine", unit: "mg/dL", range: { high: 1.3 }, high: KIDNEY },
  urea:       { label: "Urea", unit: "mg/dL", range: { high: 45 }, high: KIDNEY },
  potassium: {
    label: "Potassium", unit: "mEq/L", range: { low: 3.5, high: 5.1 },
    high: { meaning: "High potassium needs medical attention.", favour: [], limit: ["Bananas, coconut water and potassium-rich foods until you've spoken to your doctor"], nutrient: "potassium_mg", direction: "less" },
    low: { meaning: "Low potassium can cause weakness and cramps.", favour: ["Bananas, coconut water, potatoes, dals"], limit: [], nutrient: "potassium_mg", direction: "more" },
  },
  alt: { label: "ALT (liver)", unit: "U/L", range: { high: 40 }, high: LIVER },
  ast: { label: "AST (liver)", unit: "U/L", range: { high: 40 }, high: LIVER },
};

const NUTRIENT_LABEL: Record<NutrientKey, [string, string]> = {
  kcal: ["energy", "kcal"], protein_g: ["protein", "g"], carbs_g: ["carbohydrate", "g"], fat_g: ["fat", "g"],
  fiber_g: ["fibre", "g"], iron_mg: ["iron", "mg"], calcium_mg: ["calcium", "mg"], vitamin_b12_mcg: ["vitamin B12", "mcg"],
  vitamin_c_mg: ["vitamin C", "mg"], folate_mcg: ["folate", "mcg"], sodium_mg: ["sodium", "mg"], potassium_mg: ["potassium", "mg"],
};

/** Parse a printed reference range: "13.0-17.0", "< 200", ">40", "≤5.6", "Up to 40". */
export function parseRange(s: string | null | undefined): LabRange | null {
  if (!s) return null;
  const t = s.replace(/,/g, "").trim();
  const between = t.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (between) return { low: parseFloat(between[1]), high: parseFloat(between[2]) };
  const below = t.match(/^(?:<|≤|<=|up to|upto|below)\s*(\d+(?:\.\d+)?)/i);
  if (below) return { high: parseFloat(below[1]) };
  const above = t.match(/^(?:>|≥|>=|above|more than)\s*(\d+(?:\.\d+)?)/i);
  if (above) return { low: parseFloat(above[1]) };
  return null;
}

export type LabValue = { value: number; ref: string | null; date: string | null };

/** Latest value for each lab key across a member's reports. */
export function latestLabValues(
  records: { report_date: string | null; extracted_values: Record<string, unknown> | null }[],
): Record<string, LabValue> {
  const sorted = [...records].sort((a, b) => (b.report_date ?? "").localeCompare(a.report_date ?? ""));
  const out: Record<string, LabValue> = {};
  for (const r of sorted) {
    const vals = r.extracted_values ?? {};
    for (const [k, v] of Object.entries(vals)) {
      if (k.endsWith("_ref") || k in out) continue;
      const num = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
      if (!Number.isFinite(num)) continue;
      const ref = vals[`${k}_ref`];
      out[k] = { value: num, ref: typeof ref === "string" ? ref : null, date: r.report_date };
    }
  }
  return out;
}

function perServing(f: FoodData, n: NutrientKey): number | null {
  const col = n === "kcal" ? "calories" : n;
  const per100 = f[col as keyof FoodData] as number | null;
  if (per100 == null) return null;
  const w = f.serving_unit === "g" ? 100 : (f.serving_weight_g ?? 100);
  return (per100 * w) / 100;
}

/** Foods providing the most of a nutrient per serving, skipping allergy matches. */
export function topFoodsFor(n: NutrientKey, foods: FoodData[], allergies: string[] = [], count = 5): string[] {
  const avoid = allergies.map((a) => a.toLowerCase().replace(/s$/, "").trim()).filter((a) => a.length >= 3);
  const seen = new Set<string>();
  return foods
    .filter((f) => {
      const text = `${f.name} ${f.ingredients ?? ""}`.toLowerCase();
      return !avoid.some((a) => text.includes(a));
    })
    .map((f) => ({ name: f.name, amt: perServing(f, n) }))
    .filter((x): x is { name: string; amt: number } => x.amt != null && x.amt > 0)
    .sort((a, b) => b.amt - a.amt)
    .filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)))
    .slice(0, count)
    .map((x) => x.name);
}

const round = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);

/** How actual intake compares with the nutrient a flag depends on. */
export function intakeNote(g: Guidance, intake: IntakeSummary | null, needs: Needs | null): string | null {
  if (!g.nutrient || !needs) return null;
  if (!intake || intake.loggedDays === 0) return "Log your meals to see how your food compares.";
  const isMicro = !["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"].includes(g.nutrient);
  if (isMicro && intake.microCoverage < 0.3) return "Not enough of your logged food has nutrient data yet to compare.";
  const [name, unit] = NUTRIENT_LABEL[g.nutrient];
  const have = intake.perDay[g.nutrient];
  const need = needs[g.nutrient].value;
  const share = need ? Math.round((have / need) * 100) : 0;
  if (g.direction === "less") {
    return have > need
      ? `You're averaging ${round(have)} ${unit} of ${name} a day, above the ${need} ${unit} limit.`
      : `You're averaging ${round(have)} ${unit} of ${name} a day, within the ${need} ${unit} limit.`;
  }
  const verdict = share >= 90 ? "on track" : share >= 60 ? "a little short" : "well short";
  return `You're averaging ${round(have)} ${unit} of ${name} a day — ${share}% of your ${need} ${unit} need (${verdict}).`;
}

export function evaluateLabs(
  values: Record<string, LabValue>,
  opts: { intake: IntakeSummary | null; needs: Needs | null; foods: FoodData[]; allergies?: string[] },
): LabFlag[] {
  const flags: LabFlag[] = [];
  for (const [key, lv] of Object.entries(values)) {
    const rule = LAB_RULES[key];
    const range = parseRange(lv.ref) ?? rule?.range ?? null;
    if (!range) continue;
    const status = range.low != null && lv.value < range.low ? "low"
      : range.high != null && lv.value > range.high ? "high" : null;
    if (!status) continue;

    const g: Guidance = rule?.[status] ?? {
      meaning: "Outside the lab's reference range. Ask your doctor what it means for your diet.",
      favour: [], limit: [], nutrient: null, direction: "more",
    };
    const rangeText = lv.ref ?? (range.low != null && range.high != null ? `${range.low}-${range.high}` : range.high != null ? `< ${range.high}` : `> ${range.low}`);

    flags.push({
      key,
      label: rule?.label ?? key.replace(/_/g, " "),
      unit: rule?.unit ?? "",
      value: lv.value,
      status,
      range: rangeText,
      meaning: g.meaning,
      favour: g.favour,
      limit: g.limit,
      nutrient: g.nutrient,
      favourFoods: g.nutrient && g.direction === "more" ? topFoodsFor(g.nutrient, opts.foods, opts.allergies) : [],
      intakeNote: intakeNote(g, opts.intake, opts.needs),
    });
  }
  // Known findings with guidance first, then the rest
  return flags.sort((a, b) => Number(!LAB_RULES[a.key]) - Number(!LAB_RULES[b.key]));
}
