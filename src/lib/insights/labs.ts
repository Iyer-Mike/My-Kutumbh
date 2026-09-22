import type { FoodData, IntakeSummary, LabFlag, LabReading, Needs, NutrientKey } from "./types";

// General dietary guidance for common lab findings in Indian adults.
// Guidance only — the app always tells people to confirm with their doctor.

export type LabRange = { low?: number; high?: number };

type Guidance = {
  meaning: string;
  favour: string[];
  limit: string[];
  nutrient: NutrientKey | null;
  direction: "more" | "less";
  /** Never suggest sugary foods (for blood sugar / blood fat findings). */
  lowSugarOnly?: boolean;
};

type Group = { title: string; order: number; guidance?: Guidance };
type Rule = { label: string; unit: string; range: LabRange; group?: string; low?: Guidance; high?: Guidance };

const IRON: Guidance = {
  meaning: "Low iron can cause tiredness and anaemia.",
  favour: [
    "Iron-rich foods: leafy greens, dals, chana, rajma, poha",
    "Pair them with vitamin C (amla, guava, lemon) to absorb more iron",
  ],
  limit: ["Tea or coffee within an hour of meals — it blocks iron absorption"],
  nutrient: "iron_mg", direction: "more",
};

const SUGAR: Guidance = {
  meaning: "Your blood sugar is above the healthy range. HbA1c, the 3-month average, of 5.7–6.4% is prediabetes; 6.5% or more is diabetes.",
  favour: [
    "Millets and whole grains in place of some white rice and maida",
    "Dal, vegetables and fibre with every meal",
    "Protein at breakfast — curd, sprouts, dal",
  ],
  limit: ["Sweets, sugar, jaggery and sweetened drinks", "Dates and dried fruit in more than small amounts", "Large portions of white rice or rice-heavy tiffin"],
  nutrient: "fiber_g", direction: "more", lowSugarOnly: true,
};

const LIPIDS: Guidance = {
  meaning: "Your blood fats are above the healthy range, which raises heart risk.",
  favour: ["Fibre: oats, dals, vegetables and fruit", "Cooking with less oil; nuts in small portions"],
  limit: ["Fried snacks like vada and murukku", "Ghee and butter in large amounts", "Sweets and refined flour — these raise triglycerides most"],
  nutrient: "fiber_g", direction: "more", lowSugarOnly: true,
};

const KIDNEY: Guidance = {
  meaning: "A kidney marker is raised.",
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

const INFLAMMATION: Guidance = {
  meaning: "Raised CRP points to inflammation somewhere in the body. Your doctor should find the cause; food can help calm it.",
  favour: ["Vegetables, fruit, dals and whole grains every day", "Turmeric, ginger and garlic in everyday cooking"],
  limit: ["Fried food and repeatedly heated oil", "Sugar, sweets and refined flour"],
  nutrient: "fiber_g", direction: "more", lowSugarOnly: true,
};

const GROUPS: Record<string, Group> = {
  sugar:        { title: "Blood sugar", order: 1, guidance: SUGAR },
  lipids:       { title: "Cholesterol & blood fats", order: 2, guidance: LIPIDS },
  iron:         { title: "Iron & haemoglobin", order: 3, guidance: IRON },
  inflammation: { title: "Inflammation", order: 4, guidance: INFLAMMATION },
  kidney:       { title: "Kidney", order: 5, guidance: KIDNEY },
  liver:        { title: "Liver", order: 6, guidance: LIVER },
};

export const LAB_RULES: Record<string, Rule> = {
  hba1c:                { label: "HbA1c", unit: "%", range: { high: 5.6 }, group: "sugar", high: SUGAR },
  hba1c_ifcc:           { label: "HbA1c (IFCC)", unit: "mmol/mol", range: { high: 38 }, group: "sugar", high: SUGAR },
  fasting_glucose:      { label: "Fasting glucose", unit: "mg/dL", range: { low: 70, high: 99 }, group: "sugar", high: SUGAR },
  postprandial_glucose: { label: "Post-meal glucose", unit: "mg/dL", range: { high: 140 }, group: "sugar", high: SUGAR },

  total_cholesterol:    { label: "Total cholesterol", unit: "mg/dL", range: { high: 200 }, group: "lipids", high: LIPIDS },
  ldl:                  { label: "LDL", unit: "mg/dL", range: { high: 100 }, group: "lipids", high: LIPIDS },
  triglycerides:        { label: "Triglycerides", unit: "mg/dL", range: { high: 150 }, group: "lipids", high: LIPIDS },
  non_hdl_cholesterol:  { label: "Non-HDL cholesterol", unit: "mg/dL", range: { high: 130 }, group: "lipids", high: LIPIDS },
  cholesterol_hdl_ratio:{ label: "Cholesterol/HDL ratio", unit: "", range: { high: 5 }, group: "lipids", high: LIPIDS },
  vldl:                 { label: "VLDL", unit: "mg/dL", range: { high: 30 }, group: "lipids", high: LIPIDS },
  hdl: {
    label: "HDL", unit: "mg/dL", range: { low: 40 }, group: "lipids",
    low: { meaning: "Low HDL (the protective cholesterol) raises heart risk.", favour: ["Daily physical activity", "Nuts and seeds in small portions"], limit: ["Refined carbs and sweets"], nutrient: null, direction: "more" },
  },

  hemoglobin: { label: "Haemoglobin", unit: "g/dL", range: { low: 12, high: 17 }, group: "iron", low: IRON },
  iron:       { label: "Iron", unit: "μg/dL", range: { low: 60, high: 170 }, group: "iron", low: IRON },
  ferritin:   {
    label: "Ferritin", unit: "ng/mL", range: { low: 20, high: 300 }, group: "iron",
    low: IRON,
    high: { meaning: "High ferritin can reflect inflammation or too much iron.", favour: [], limit: ["Iron supplements unless prescribed"], nutrient: null, direction: "less" },
  },

  crp: { label: "CRP", unit: "mg/L", range: { high: 3 }, group: "inflammation", high: INFLAMMATION },

  creatinine: { label: "Creatinine", unit: "mg/dL", range: { high: 1.3 }, group: "kidney", high: KIDNEY },
  urea:       { label: "Urea", unit: "mg/dL", range: { high: 45 }, group: "kidney", high: KIDNEY },

  alt: { label: "ALT (liver)", unit: "U/L", range: { high: 40 }, group: "liver", high: LIVER },
  ast: { label: "AST (liver)", unit: "U/L", range: { high: 40 }, group: "liver", high: LIVER },
  ggt: { label: "GGT (liver)", unit: "U/L", range: { high: 50 }, group: "liver", high: LIVER },

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
  potassium: {
    label: "Potassium", unit: "mEq/L", range: { low: 3.5, high: 5.1 },
    high: { meaning: "High potassium needs medical attention.", favour: [], limit: ["Bananas, coconut water and potassium-rich foods until you've spoken to your doctor"], nutrient: "potassium_mg", direction: "less" },
    low: { meaning: "Low potassium can cause weakness and cramps.", favour: ["Bananas, coconut water, potatoes, dals"], limit: [], nutrient: "potassium_mg", direction: "more" },
  },
};

// Other names labs and the report reader use for the same tests
const ALIASES: Record<string, string> = {
  hba1c_ifcc_mmol_mol: "hba1c_ifcc", hba1c_mmol_mol: "hba1c_ifcc", glycated_hemoglobin: "hba1c",
  fbs: "fasting_glucose", glucose_fasting: "fasting_glucose", ppbs: "postprandial_glucose",
  cholesterol: "total_cholesterol", ldl_cholesterol: "ldl", hdl_cholesterol: "hdl", vldl_cholesterol: "vldl",
  non_hdl: "non_hdl_cholesterol",
  total_cholesterol_hdl_ratio: "cholesterol_hdl_ratio", tc_hdl_ratio: "cholesterol_hdl_ratio", chol_hdl_ratio: "cholesterol_hdl_ratio",
  haemoglobin: "hemoglobin", hb: "hemoglobin", serum_ferritin: "ferritin", serum_iron: "iron",
  hs_crp: "crp", hscrp: "crp", c_reactive_protein: "crp",
  sgpt: "alt", sgot: "ast", gamma_gt: "ggt",
  vitamin_d3: "vitamin_d", vitamin_d_25_oh: "vitamin_d", "25_oh_vitamin_d": "vitamin_d",
  b12: "vitamin_b12", serum_creatinine: "creatinine", blood_urea: "urea",
};

export const canonicalKey = (k: string) => ALIASES[k] ?? k;

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

const SUGARY_NAME = /date|jaggery|sugar|halwa|payasam|kheer|laddu|jalebi|sweet|honey|raisin|chiku|sapota/i;

/** A food to keep off blood-sugar and blood-fat suggestions. */
export function isSugary(f: FoodData): boolean {
  return f.category === "dessert" || f.category === "sweet" || (f.carbs_g ?? 0) > 40 || SUGARY_NAME.test(f.name);
}

/** Foods providing the most of a nutrient per serving, skipping allergy matches. */
export function topFoodsFor(
  n: NutrientKey, foods: FoodData[], allergies: string[] = [], count = 5, lowSugarOnly = false,
): string[] {
  const avoid = allergies.map((a) => a.toLowerCase().replace(/s$/, "").trim()).filter((a) => a.length >= 3);
  const seen = new Set<string>();
  return foods
    .filter((f) => {
      if (lowSugarOnly && isSugary(f)) return false;
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

/** How actual intake compares with the nutrient a finding depends on. */
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

const unique = (xs: string[]) => [...new Set(xs)];

export function evaluateLabs(
  values: Record<string, LabValue>,
  opts: { intake: IntakeSummary | null; needs: Needs | null; foods: FoodData[]; allergies?: string[] },
): LabFlag[] {
  type Bucket = { key: string; title: string; order: number; known: boolean; readings: LabReading[]; guides: Guidance[] };
  const buckets = new Map<string, Bucket>();

  for (const [rawKey, lv] of Object.entries(values)) {
    const key = canonicalKey(rawKey);
    const rule = LAB_RULES[key];
    const range = parseRange(lv.ref) ?? rule?.range ?? null;
    if (!range) continue;
    const status = range.low != null && lv.value < range.low ? "low"
      : range.high != null && lv.value > range.high ? "high" : null;
    if (!status) continue;

    const guide = rule?.[status];
    const rangeText = lv.ref ?? (range.low != null && range.high != null ? `${range.low}-${range.high}` : range.high != null ? `< ${range.high}` : `> ${range.low}`);
    const reading: LabReading = {
      key: rawKey, label: rule?.label ?? rawKey.replace(/_/g, " "), unit: rule?.unit ?? "",
      value: lv.value, status, range: rangeText,
    };

    // Readings without a dietary rule are collected under "other values"
    const groupKey = guide ? (rule?.group ?? key) : "other";
    const group = GROUPS[groupKey];
    const b = buckets.get(groupKey) ?? {
      key: groupKey,
      title: group?.title ?? (guide ? reading.label : "Other values outside the range"),
      order: group?.order ?? (guide ? 50 : 99),
      known: !!guide,
      readings: [],
      guides: [],
    };
    b.readings.push(reading);
    if (guide) b.guides.push(guide);
    buckets.set(groupKey, b);
  }

  const flags: LabFlag[] = [];
  for (const b of buckets.values()) {
    const base = GROUPS[b.key]?.guidance ?? b.guides[0];
    if (!base) {
      flags.push({
        key: b.key, label: b.title, readings: b.readings, known: false,
        meaning: "These have no specific food advice. Ask your doctor what they mean for you.",
        favour: [], limit: [], nutrient: null, favourFoods: [], intakeNote: null,
      });
      continue;
    }
    // A single finding keeps its own wording (e.g. HDL low within lipids)
    const only = b.guides.length === 1 ? b.guides[0] : base;
    flags.push({
      key: b.key, label: b.title, readings: b.readings, known: true,
      meaning: only.meaning,
      favour: unique(b.guides.flatMap((g) => g.favour)),
      limit: unique(b.guides.flatMap((g) => g.limit)),
      nutrient: only.nutrient,
      favourFoods: only.nutrient && only.direction === "more"
        ? topFoodsFor(only.nutrient, opts.foods, opts.allergies, 5, b.guides.some((g) => g.lowSugarOnly))
        : [],
      intakeNote: intakeNote(only, opts.intake, opts.needs),
    });
  }
  return flags.sort((a, b) => (buckets.get(a.key)!.order - buckets.get(b.key)!.order));
}
