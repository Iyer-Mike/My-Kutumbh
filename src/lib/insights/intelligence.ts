import type { CorrectionEvent, IntakeSummary, LogEntry, Needs, Profile } from "./types";
import { canonicalKey, isSugary, parseRange, type LabValue } from "./labs.ts";

// The Intelligence layer: correlates medicines, allergies, conditions and
// combined lab patterns with what a member actually eats. General guidance,
// never advice to change a medicine.

// Generic names plus common Indian brand names, matched case-insensitively
const MEDS = {
  metformin:    ["metformin", "glycomet", "glucophage", "obimet", "gluconorm", "janumet", "istamet"],
  thyroid:      ["levothyroxine", "thyroxine", "thyronorm", "eltroxin", "thyrox", "lethyrox"],
  aceArb:       ["telmisartan", "telma", "losartan", "losar", "olmesartan", "olmezest", "valsartan", "ramipril", "cardace", "enalapril", "lisinopril"],
  bpOther:      ["amlodipine", "amlong", "stamlo", "cilnidipine", "metoprolol", "atenolol", "nebivolol"],
  diuretic:     ["hydrochlorothiazide", "hctz", "furosemide", "lasix", "torsemide", "chlorthalidone", "indapamide"],
  bloodThinner: ["warfarin", "acenocoumarol", "acitrom", "nicoumalone"],
  sugarLowering:["glimepiride", "amaryl", "gliclazide", "glizid", "glipizide", "glibenclamide", "insulin"],
  acidReducer:  ["pantoprazole", "pantocid", "pan 40", "pan-40", "omeprazole", "rabeprazole", "razo", "esomeprazole"],
} as const;

type MedGroup = keyof typeof MEDS;

export function medicationGroups(meds: string[] | null | undefined): Map<MedGroup, string> {
  const found = new Map<MedGroup, string>();
  for (const raw of meds ?? []) {
    const m = raw.toLowerCase();
    for (const [group, names] of Object.entries(MEDS) as [MedGroup, readonly string[]][]) {
      if (!found.has(group) && names.some((n) => m.includes(n))) found.set(group, raw.trim());
    }
  }
  return found;
}

const has = (list: string[] | null | undefined, word: RegExp) => (list ?? []).some((c) => word.test(c));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const FRIED = /vada|murukku|bajji|bhaji|pakora|pakoda|samosa|puri|poori|chips|mixture|bonda|fried/i;

type Input = {
  profile: Profile;
  needs: Needs;
  intake: IntakeSummary;           // the period being viewed
  entries: LogEntry[];             // logs in that period
  labs: Record<string, LabValue>;  // latest values (raw keys)
};

/** Latest lab values keyed by canonical test name, with low/high status. */
function labStatus(labs: Record<string, LabValue>) {
  const out: Record<string, { value: number; status: "low" | "high" | "normal" }> = {};
  for (const [k, v] of Object.entries(labs)) {
    const key = canonicalKey(k);
    if (key in out) continue;
    const r = parseRange(v.ref);
    const status = r?.low != null && v.value < r.low ? "low" : r?.high != null && v.value > r.high ? "high" : "normal";
    out[key] = { value: v.value, status };
  }
  return out;
}

export function evaluateIntelligence({ profile, needs, intake, entries, labs }: Input): CorrectionEvent[] {
  const ev: CorrectionEvent[] = [];
  const meds = medicationGroups(profile.medications);
  const lab = labStatus(labs);
  const logged = intake.loggedDays > 0;
  const ratio = (k: keyof Needs) => (needs[k].value ? intake.perDay[k] / needs[k].value : 0);
  const microOk = intake.microCoverage >= 0.3;

  // ── Medicines × food ──────────────────────────────────────────
  if (meds.has("metformin")) {
    const b12Lab = lab.vitamin_b12;
    const lowIntake = logged && microOk && ratio("vitamin_b12_mcg") < 0.6;
    const evidence = [`Takes ${meds.get("metformin")}`];
    if (b12Lab) evidence.push(`Last B12 test: ${b12Lab.value} pg/mL${b12Lab.status === "low" ? " (low)" : ""}`);
    if (logged && microOk) evidence.push(`B12 from food: ${pct(ratio("vitamin_b12_mcg"))} of daily need`);
    ev.push({
      id: "med-metformin-b12", category: "medicine",
      severity: b12Lab?.status === "low" ? "alert" : lowIntake || (b12Lab && b12Lab.value < 300) ? "watch" : "tip",
      title: "Metformin and vitamin B12",
      detail: "Long-term metformin can lower vitamin B12, which affects energy and nerves.",
      action: "Ask your doctor to check B12 once a year. Include curd, buttermilk or paneer every day.",
      evidence,
    });
  }

  if (meds.has("thyroid")) {
    ev.push({
      id: "med-thyroid-timing", category: "medicine", severity: "tip",
      title: "Thyroid medicine timing",
      detail: "Food, tea, coffee, milk, calcium and iron all reduce how much thyroid medicine you absorb.",
      action: "Take it on an empty stomach, 30–60 minutes before breakfast. Keep milk, curd, tea, coffee, calcium and iron tablets at least 4 hours apart from it.",
      evidence: [`Takes ${meds.get("thyroid")}`],
    });
  }

  if (meds.has("aceArb")) {
    const kHigh = lab.potassium?.status === "high";
    ev.push({
      id: "med-acearb-potassium", category: "medicine", severity: kHigh ? "alert" : "tip",
      title: "BP medicine and potassium",
      detail: "Medicines like telmisartan and losartan raise potassium in the blood.",
      action: "Avoid 'low-sodium' salt substitutes (they are potassium chloride). Don't overdo coconut water or bananas without asking your doctor.",
      evidence: [`Takes ${meds.get("aceArb")}`, ...(lab.potassium ? [`Last potassium: ${lab.potassium.value} mEq/L${kHigh ? " (high)" : ""}`] : [])],
    });
  }

  if (meds.has("diuretic") && !meds.has("aceArb")) {
    ev.push({
      id: "med-diuretic-potassium", category: "medicine", severity: lab.potassium?.status === "low" ? "alert" : "tip",
      title: "Water tablets and potassium",
      detail: "Diuretics can wash potassium out of the body.",
      action: "Include potassium-rich foods such as coconut water, bananas, potatoes and dals, unless your doctor has said otherwise.",
      evidence: [`Takes ${meds.get("diuretic")}`],
    });
  }

  if (meds.has("bloodThinner")) {
    ev.push({
      id: "med-warfarin-greens", category: "medicine", severity: "watch",
      title: "Blood thinner and leafy greens",
      detail: "Vitamin K in leafy greens changes how warfarin-type medicines work.",
      action: "You don't need to avoid greens — keep the amount steady from week to week, and tell your doctor before big diet changes.",
      evidence: [`Takes ${meds.get("bloodThinner")}`],
    });
  }

  if (meds.has("sugarLowering")) {
    const days = [...new Set(entries.map((e) => e.logged_date))];
    const noBreakfast = days.filter((d) => !entries.some((e) => e.logged_date === d && e.meal_slot === "breakfast")).length;
    ev.push({
      id: "med-sulfonylurea-meals", category: "medicine", severity: noBreakfast >= 2 ? "watch" : "tip",
      title: "Sugar-lowering medicine and skipped meals",
      detail: "Medicines like glimepiride and insulin can drop blood sugar too low if a meal is missed.",
      action: "Eat at regular times, especially breakfast. Keep a small snack handy when you're out.",
      evidence: [`Takes ${meds.get("sugarLowering")}`, ...(noBreakfast ? [`No breakfast logged on ${noBreakfast} of ${days.length} logged days`] : [])],
    });
  }

  if (meds.has("acidReducer")) {
    const b12Low = lab.vitamin_b12?.status === "low";
    ev.push({
      id: "med-ppi-absorption", category: "medicine", severity: b12Low ? "watch" : "tip",
      title: "Acidity medicine and nutrient absorption",
      detail: "Long-term pantoprazole-type medicines reduce absorption of B12, iron and calcium.",
      action: "Include dairy, dals and greens daily, and ask your doctor whether you still need it long term.",
      evidence: [`Takes ${meds.get("acidReducer")}`],
    });
  }

  // ── Allergies × logged food ───────────────────────────────────
  for (const allergy of profile.allergies ?? []) {
    const term = allergy.toLowerCase().replace(/s$/, "").trim();
    if (term.length < 3) continue;
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    const hits = [...new Set(entries
      .filter((e) => {
        const text = `${e.food_name} ${e.food?.name ?? ""} ${e.food?.ingredients ?? ""}`.toLowerCase();
        if (text.includes(term)) return true;
        // "oily foods" → fried/oily dishes
        return /oil|fried|fat/.test(term) && (FRIED.test(text) || (e.food?.fat_g ?? 0) >= 12);
      })
      .map((e) => e.food_name))];
    if (!hits.length) continue;
    ev.push({
      id: `allergy-${words.join("-") || term}`, category: "allergy", severity: "alert",
      title: `Logged food that may not suit you: ${allergy}`,
      detail: `Your profile lists "${allergy}" as an allergy or intolerance.`,
      action: "Check how these were prepared, and choose alternatives if they caused discomfort.",
      evidence: hits.slice(0, 5).map((h) => `Logged: ${h}`),
    });
  }

  // ── Conditions × logged food ──────────────────────────────────
  if (has(profile.conditions, /hypertension|blood pressure/i) && logged && microOk && intake.perDay.sodium_mg > needs.sodium_mg.value) {
    ev.push({
      id: "cond-bp-salt", category: "condition", severity: "alert",
      title: "Salt is above the limit for high blood pressure",
      detail: `You're averaging ${Math.round(intake.perDay.sodium_mg)} mg of sodium a day, above the ${needs.sodium_mg.value} mg limit.`,
      action: "Cut back on pickles, papad, salted snacks and extra salt at the table; season with lemon, herbs and spices instead.",
      evidence: ["Condition: hypertension", `Sodium: ${pct(intake.perDay.sodium_mg / needs.sodium_mg.value)} of the daily limit`],
    });
  }

  if (has(profile.conditions, /diabet/i) && logged) {
    const sweets = entries.filter((e) => e.food && isSugary(e.food)).map((e) => e.food_name);
    const carbShare = intake.perDay.kcal ? (intake.perDay.carbs_g * 4) / intake.perDay.kcal : 0;
    if (sweets.length >= 2 || carbShare > 0.65) {
      ev.push({
        id: "cond-diabetes-carbs", category: "condition", severity: "watch",
        title: "Sugar and carbs with diabetes",
        detail: carbShare > 0.65
          ? `${pct(carbShare)} of your energy came from carbohydrate — above the ~55% that suits diabetes.`
          : "Several sweet or sugary items were logged this period.",
        action: "Swap part of the rice for dal or vegetables, and keep sweets to small, occasional portions.",
        evidence: ["Condition: diabetes", ...(carbShare > 0 ? [`Carbohydrate: ${pct(carbShare)} of energy`] : []), ...[...new Set(sweets)].slice(0, 3).map((s) => `Logged: ${s}`)],
      });
    }
  }

  if (has(profile.conditions, /cholesterol/i) && logged) {
    const fried = [...new Set(entries.filter((e) => FRIED.test(e.food_name) || (e.food?.category === "snack" && (e.food?.fat_g ?? 0) >= 10)).map((e) => e.food_name))];
    if (fried.length >= 2) {
      ev.push({
        id: "cond-cholesterol-fried", category: "condition", severity: "watch",
        title: "Fried food with high cholesterol",
        detail: "Fried snacks were logged more than once this period.",
        action: "Try steamed or roasted versions (idli over vada, roasted chana over mixture), and cook with less oil.",
        evidence: ["Condition: high cholesterol", ...fried.slice(0, 3).map((f) => `Logged: ${f}`)],
      });
    }
  }

  // ── Patterns across lab values ────────────────────────────────
  const sugarHigh = lab.hba1c?.status === "high" || lab.fasting_glucose?.status === "high" || lab.hba1c_ifcc?.status === "high";
  const tgHigh = lab.triglycerides?.status === "high";
  const hdlLow = lab.hdl?.status === "low";
  const ldlHigh = lab.ldl?.status === "high" || lab.total_cholesterol?.status === "high" || lab.non_hdl_cholesterol?.status === "high";

  if (sugarHigh && tgHigh) {
    ev.push({
      id: "pattern-insulin-resistance", category: "pattern", severity: "alert",
      title: "High sugar and high triglycerides together",
      detail: `This combination${hdlLow ? ", with low HDL," : ""} points to insulin resistance — the body struggling to use sugar. It responds well to food changes.`,
      action: "The biggest levers are fewer sweets and refined carbs, more dal and vegetables at each meal, and a daily 30-minute walk.",
      evidence: [
        lab.hba1c ? `HbA1c ${lab.hba1c.value}%` : "Blood sugar high",
        `Triglycerides ${lab.triglycerides!.value} mg/dL`,
        ...(hdlLow ? [`HDL ${lab.hdl!.value} mg/dL (low)`] : []),
      ],
    });
  }

  if (sugarHigh && ldlHigh) {
    ev.push({
      id: "pattern-sugar-cholesterol", category: "pattern", severity: "watch",
      title: "Blood sugar and cholesterol are both high",
      detail: "Together they raise heart risk more than either alone. The good news: the same foods help both.",
      action: "Fibre at every meal (dals, vegetables, whole grains), less fried food, and small portions of sweets.",
      evidence: [
        lab.hba1c ? `HbA1c ${lab.hba1c.value}%` : "Blood sugar high",
        lab.ldl ? `LDL ${lab.ldl.value} mg/dL` : lab.total_cholesterol ? `Total cholesterol ${lab.total_cholesterol.value} mg/dL` : "Cholesterol high",
      ],
    });
  }

  if (lab.hemoglobin?.status === "low" && lab.ferritin?.status === "low") {
    ev.push({
      id: "pattern-iron-anaemia", category: "pattern", severity: "alert",
      title: "Signs of iron-deficiency anaemia",
      detail: "Low haemoglobin with low ferritin usually means the body has run short of iron.",
      action: "Eat iron-rich foods with vitamin C (greens with lemon, dal with amla), keep tea away from meals, and ask your doctor about iron tablets.",
      evidence: [`Haemoglobin ${lab.hemoglobin.value} g/dL (low)`, `Ferritin ${lab.ferritin.value} ng/mL (low)`],
    });
  }

  if (lab.vitamin_d?.status === "low" && logged && microOk && ratio("calcium_mg") < 0.6) {
    ev.push({
      id: "pattern-bone", category: "pattern", severity: "watch",
      title: "Low vitamin D and low calcium intake",
      detail: "Both are needed for strong bones, and both are short right now.",
      action: "Daily morning sun, curd or milk every day, ragi and sesame — and ask your doctor about vitamin D.",
      evidence: [`Vitamin D ${lab.vitamin_d.value} ng/mL (low)`, `Calcium from food: ${pct(ratio("calcium_mg"))} of need`],
    });
  }

  if (lab.crp?.status === "high" && (sugarHigh || ldlHigh)) {
    ev.push({
      id: "pattern-inflammation-metabolic", category: "pattern", severity: "watch",
      title: "Inflammation alongside sugar or cholesterol",
      detail: "Raised CRP with metabolic changes adds to heart risk. Your doctor should look for the cause.",
      action: "Favour vegetables, dals and whole grains; cut fried food, sugar and refined flour; use turmeric and ginger in cooking.",
      evidence: [`CRP ${lab.crp.value}`, sugarHigh ? "Blood sugar high" : "Cholesterol high"],
    });
  }

  const order = { alert: 0, watch: 1, tip: 2 };
  return ev.sort((a, b) => order[a.severity] - order[b.severity]);
}
