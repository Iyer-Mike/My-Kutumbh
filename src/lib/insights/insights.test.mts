import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ageOn, computeNeeds, kcalTarget } from "./needs.ts";
import { datesBetween, entryNutrients, gramsOf, summarizeIntake } from "./intake.ts";
import { doshasOf, summarizeAyurveda } from "./ayurveda.ts";
import { evaluateLabs, latestLabValues, parseRange, topFoodsFor } from "./labs.ts";
import { energyNarrative, microNarrative, trendNarrative, ayurvedaNarrative, labNarrative } from "./narrate.ts";
import type { FoodData, LogEntry, Profile } from "./types.ts";

// ── Fixtures ──────────────────────────────────────────────────────
const food = (over: Partial<FoodData>): FoodData => ({
  name: "Food", category: "other", serving_unit: "serving", serving_weight_g: 100,
  calories: 100, protein_g: 2, carbs_g: 20, fat_g: 1, fiber_g: 1,
  iron_mg: 1, calcium_mg: 10, vitamin_b12_mcg: 0, vitamin_c_mg: 0, folate_mcg: 10,
  sodium_mg: 100, potassium_mg: 100, rasa: ["sweet"], virya: "neutral",
  vata_effect: "neutral", pitta_effect: "neutral", kapha_effect: "neutral", ingredients: null, ...over,
});

const IDLI   = food({ name: "Idli", serving_unit: "piece", serving_weight_g: 40, calories: 130, protein_g: 3.5, iron_mg: 0.6, sodium_mg: 250, rasa: ["sweet", "sour"], virya: "cooling", kapha_effect: "aggravates" });
const SAMBAR = food({ name: "Sambar", serving_unit: "bowl", serving_weight_g: 150, calories: 54, iron_mg: 0.8, sodium_mg: 350, rasa: ["sour", "pungent"], virya: "heating", pitta_effect: "neutral" });
const RASAM  = food({ name: "Rasam", serving_unit: "bowl", serving_weight_g: 150, calories: 28, sodium_mg: 400, rasa: ["sour", "pungent", "salty"], virya: "heating", pitta_effect: "aggravates" });
const PANEER = food({ name: "Paneer", serving_unit: "serving", serving_weight_g: 100, calories: 265, vitamin_b12_mcg: 0.8, calcium_mg: 300, ingredients: "milk" });
const CURD   = food({ name: "Curd / Yogurt", serving_unit: "cup", serving_weight_g: 150, calories: 61, vitamin_b12_mcg: 0.4, calcium_mg: 121, ingredients: "milk" });
const SPINACH = food({ name: "Spinach (cooked)", serving_unit: "bowl", serving_weight_g: 150, calories: 23, iron_mg: 3.6, folate_mcg: 146 });

const log = (over: Partial<LogEntry>): LogEntry => ({
  logged_date: "2026-09-22", meal_slot: "breakfast", food_name: "Idli", quantity_g: 2, quantity_unit: "piece",
  calories: null, protein_g: null, nutrition_estimated: false, food: IDLI, ...over,
});

const MOHAN: Profile = {
  date_of_birth: "1953-05-10", gender: "male", height_cm: 178, weight_kg: 70, activity_level: "moderate",
  daily_kcal_goal: null, primary_dosha: "pitta", diet_type: "vegetarian", allergies: ["oily foods"], conditions: ["Diabetes"],
};

// ── Needs ─────────────────────────────────────────────────────────
describe("needs", () => {
  test("age respects the birthday", () => {
    assert.equal(ageOn("1953-09-23", "2026-09-22"), 72);
    assert.equal(ageOn("1953-09-22", "2026-09-22"), 73);
    assert.equal(ageOn(null, "2026-09-22"), null);
  });

  test("kcal from Mifflin–St Jeor × activity when no goal is set", () => {
    // 10×70 + 6.25×178 − 5×73 + 5 = 1452.5 → × 1.55 = 2251 → rounded to 2250
    const t = kcalTarget(MOHAN, "2026-09-22");
    assert.equal(t.value, 2250);
    assert.match(t.source, /estimated from your profile/);
  });

  test("a daily goal overrides the estimate", () => {
    assert.equal(kcalTarget({ ...MOHAN, daily_kcal_goal: 1800 }, "2026-09-22").value, 1800);
  });

  test("an incomplete profile is flagged as a rough estimate", () => {
    assert.match(kcalTarget({ ...MOHAN, weight_kg: null }, "2026-09-22").source, /rough estimate/);
  });

  test("sex- and age-specific micronutrients", () => {
    const man = computeNeeds(MOHAN, "2026-09-22");
    assert.equal(man.iron_mg.value, 19);
    assert.equal(man.protein_g.value, 58);           // 0.83 × 70
    assert.equal(man.sodium_mg.kind, "limit");
    const woman = computeNeeds({ ...MOHAN, gender: "female", date_of_birth: "1990-01-01" }, "2026-09-22");
    assert.equal(woman.iron_mg.value, 29);
    assert.equal(woman.vitamin_c_mg.value, 65);
    const olderWoman = computeNeeds({ ...MOHAN, gender: "female" }, "2026-09-22");
    assert.equal(olderWoman.calcium_mg.value, 1200);
  });
});

// ── Intake ────────────────────────────────────────────────────────
describe("intake", () => {
  test("grams come from serving weight, or directly for grams", () => {
    assert.equal(gramsOf(log({})), 80);                                   // 2 idli × 40 g
    assert.equal(gramsOf(log({ quantity_unit: "g", quantity_g: 150 })), 150);
    assert.equal(gramsOf(log({ food: null })), null);
  });

  test("saved kcal wins; micronutrients come from food data × grams", () => {
    const { n, microKnown } = entryNutrients(log({ calories: 104 }));
    assert.equal(n.kcal, 104);
    assert.ok(Math.abs(n.iron_mg - 0.48) < 1e-9);                        // 0.6 × 80/100
    assert.equal(n.sodium_mg, 200);
    assert.equal(microKnown, true);
  });

  test("a food-less (outside) log counts kcal but no micronutrients", () => {
    const { n, microKnown } = entryNutrients(log({ food: null, calories: 420, nutrition_estimated: true }));
    assert.equal(n.kcal, 420);
    assert.equal(n.iron_mg, 0);
    assert.equal(microKnown, false);
  });

  test("averages over logged days, keeps empty days in the trend, filters the range", () => {
    const entries = [
      log({ logged_date: "2026-09-20", calories: 400 }),
      log({ logged_date: "2026-09-22", calories: 600 }),
      log({ logged_date: "2026-09-22", food: null, calories: 200, nutrition_estimated: true }),
      log({ logged_date: "2026-09-10", calories: 9999 }),                 // outside the range
    ];
    const s = summarizeIntake(entries, "2026-09-20", "2026-09-22");
    assert.equal(s.days, 3);
    assert.equal(s.loggedDays, 2);
    assert.equal(s.items, 3);
    assert.equal(s.perDay.kcal, 600);                                     // (400+600+200)/2
    assert.deepEqual(s.daily.map((d) => d.kcal), [400, 0, 800]);
    assert.ok(Math.abs(s.microCoverage - 1000 / 1200) < 1e-9);
    assert.ok(Math.abs(s.estimatedShare - 200 / 1200) < 1e-9);
  });

  test("no logs gives zeros, not NaN", () => {
    const s = summarizeIntake([], "2026-09-16", "2026-09-22");
    assert.equal(s.loggedDays, 0);
    assert.equal(s.perDay.kcal, 0);
    assert.equal(s.daily.length, 7);
  });

  test("date ranges cross month ends", () => {
    assert.deepEqual(datesBetween("2026-02-27", "2026-03-02"), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

// ── Ayurveda ──────────────────────────────────────────────────────
describe("ayurveda", () => {
  test("dosha names parse", () => {
    assert.deepEqual(doshasOf("vata-pitta"), ["vata", "pitta"]);
    assert.deepEqual(doshasOf("tridosha"), ["vata", "pitta", "kapha"]);
    assert.deepEqual(doshasOf(null), []);
  });

  test("a Pitta person eating mostly heating, Pitta-aggravating food gets notes", () => {
    const entries = [
      log({ food: RASAM, calories: 300 }),
      log({ food: RASAM, calories: 300 }),
      log({ food: SAMBAR, calories: 200 }),
      log({ food: IDLI, calories: 200 }),
    ];
    const a = summarizeAyurveda(entries, "pitta");
    assert.equal(a.coverage, 1);
    assert.ok(Math.abs(a.virya.heating - 0.8) < 1e-9);                  // 800 of 1000
    assert.ok(Math.abs(a.aggravatingShare.pitta - 0.6) < 1e-9);          // rasam only
    assert.ok(a.notes.some((n) => /aggravate Pitta/.test(n)));
    assert.ok(a.notes.some((n) => /Heating foods made up 80%/.test(n)));
    assert.ok(a.missingTastes.includes("bitter"));
    const sum = Object.values(a.tasteShare).reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  test("food without Ayurvedic data doesn't count toward coverage", () => {
    const a = summarizeAyurveda([log({ food: null, calories: 500 }), log({ food: IDLI, calories: 500 })], "vata");
    assert.equal(a.coverage, 0.5);
  });
});

// ── Labs ──────────────────────────────────────────────────────────
describe("labs", () => {
  test("reference ranges in printed formats", () => {
    assert.deepEqual(parseRange("13.0-17.0"), { low: 13, high: 17 });
    assert.deepEqual(parseRange("0.55 – 4.78"), { low: 0.55, high: 4.78 });
    assert.deepEqual(parseRange("< 200"), { high: 200 });
    assert.deepEqual(parseRange(">40"), { low: 40 });
    assert.deepEqual(parseRange("Up to 40"), { high: 40 });
    assert.equal(parseRange("see note"), null);
    assert.equal(parseRange(null), null);
  });

  test("the latest report wins for each value", () => {
    const v = latestLabValues([
      { report_date: "2026-03-01", extracted_values: { vitamin_d: 10, hemoglobin: 12.5 } },
      { report_date: "2026-08-20", extracted_values: { vitamin_d: 13.24, vitamin_d_ref: "30-100", note: "text" } },
    ]);
    assert.equal(v.vitamin_d.value, 13.24);
    assert.equal(v.vitamin_d.ref, "30-100");
    assert.equal(v.hemoglobin.value, 12.5);                              // only in the older report
    assert.equal(v.note, undefined);                                     // non-numeric skipped
  });

  test("foods ranked by nutrient per serving, skipping allergy matches", () => {
    const foods = [IDLI, SAMBAR, PANEER, CURD, SPINACH];
    assert.deepEqual(topFoodsFor("vitamin_b12_mcg", foods), ["Paneer", "Curd / Yogurt"]);   // 0.8 vs 0.6 per serving
    assert.equal(topFoodsFor("iron_mg", foods)[0], "Spinach (cooked)");
    assert.deepEqual(topFoodsFor("vitamin_b12_mcg", foods, ["milk"]), []);                   // both contain milk
  });

  test("the user's real report: grouped, aliased, CRP recognised, TSH normal", () => {
    // Values as extracted from the 20 Aug 2026 report
    const values = latestLabValues([{
      report_date: "2026-08-20",
      extracted_values: {
        ldl: 155, ldl_ref: "<100",
        hba1c: 6.6, hba1c_ref: "<5.7",
        vitamin_d: 13.24, vitamin_d_ref: "30-100",
        triglycerides: 150, triglycerides_ref: "30-149",
        total_cholesterol: 232, total_cholesterol_ref: "<200",
        crp: 9.8, crp_ref: "0.0-3.3",
        hba1c_ifcc_mmol_mol: 48.6, hba1c_ifcc_mmol_mol_ref: "<39.0",
        non_hdl_cholesterol: 186, non_hdl_cholesterol_ref: "<130",
        urine_specific_gravity: 1.005, urine_specific_gravity_ref: "1.015-1.025",
        total_cholesterol_hdl_ratio: 5, total_cholesterol_hdl_ratio_ref: "0.0-4.9",
        tsh: 4.046, tsh_ref: "0.55-4.78",
        vitamin_b12: 238, vitamin_b12_ref: "211-911",
      },
    }]);
    const flags = evaluateLabs(values, { intake: null, needs: computeNeeds(MOHAN, "2026-09-22"), foods: [] });

    // 10 out-of-range readings become 5 findings, in priority order
    assert.deepEqual(flags.map((f) => f.key), ["sugar", "lipids", "inflammation", "vitamin_d", "other"]);
    const [sugar, lipids, crp, , other] = flags;
    assert.deepEqual(sugar.readings.map((r) => r.label), ["HbA1c", "HbA1c (IFCC)"]);
    assert.deepEqual(lipids.readings.map((r) => r.label).sort(),
      ["Cholesterol/HDL ratio", "LDL", "Non-HDL cholesterol", "Total cholesterol", "Triglycerides"]);
    assert.equal(lipids.label, "Cholesterol & blood fats");
    assert.equal(crp.readings[0].value, 9.8);
    assert.deepEqual(other.readings.map((r) => r.key), ["urine_specific_gravity"]);
    assert.equal(other.known, false);
    assert.equal(other.readings[0].value, 1.005);                        // not rounded to 1
    // TSH 4.046 and B12 238 are within their ranges: not flagged
    assert.ok(!flags.some((f) => f.readings.some((r) => r.key === "tsh" || r.key === "vitamin_b12")));
  });

  test("blood sugar and blood fat findings never suggest sugary foods", () => {
    const DATES = food({ name: "Dates (dry)", serving_weight_g: 30, carbs_g: 75, fiber_g: 8 });
    const CHICKPEA = food({ name: "Chickpeas (cooked)", serving_weight_g: 150, carbs_g: 27.4, fiber_g: 7.6 });
    const HALWA = food({ name: "Rava Halwa", category: "sweet", serving_weight_g: 100, carbs_g: 35, fiber_g: 20 });
    const flags = evaluateLabs(
      { hba1c: { value: 6.6, ref: "<5.7", date: null } },
      { intake: null, needs: computeNeeds(MOHAN, "2026-09-22"), foods: [DATES, CHICKPEA, HALWA] },
    );
    assert.deepEqual(flags[0].favourFoods, ["Chickpeas (cooked)"]);
    // …but a plain fibre ranking would still include them
    assert.ok(topFoodsFor("fiber_g", [DATES, CHICKPEA, HALWA]).includes("Rava Halwa"));
  });

  test("a single finding keeps its own wording and advice", () => {
    const needs = computeNeeds(MOHAN, "2026-09-22");
    const intake = summarizeIntake([log({ food: CURD, quantity_g: 1, quantity_unit: "cup", calories: 91 })], "2026-09-16", "2026-09-22");
    const flags = evaluateLabs(
      { vitamin_b12: { value: 180, ref: "211-911", date: null }, hdl: { value: 35, ref: ">40", date: null } },
      { intake, needs, foods: [IDLI, PANEER, CURD, SPINACH] },
    );
    const b12 = flags.find((f) => f.key === "vitamin_b12")!;
    assert.deepEqual(b12.favourFoods, ["Paneer", "Curd / Yogurt"]);
    assert.match(b12.intakeNote ?? "", /24% of your 2\.5 mcg need \(well short\)/);   // 0.6 of 2.5
    const lipids = flags.find((f) => f.key === "lipids")!;
    assert.match(lipids.meaning, /Low HDL/);                                         // not the generic lipid text
  });

  test("with no meals logged, the note asks for logging", () => {
    const flags = evaluateLabs(
      { hemoglobin: { value: 11.2, ref: "13.0-17.0", date: null } },
      { intake: summarizeIntake([], "2026-09-16", "2026-09-22"), needs: computeNeeds(MOHAN, "2026-09-22"), foods: [SPINACH] },
    );
    assert.equal(flags[0].readings[0].status, "low");
    assert.equal(flags[0].intakeNote, "Log your meals to see how your food compares.");
    assert.deepEqual(flags[0].favourFoods, ["Spinach (cooked)"]);
  });

  test("limits read as above or within the limit", () => {
    const needs = computeNeeds(MOHAN, "2026-09-22");
    const salty = summarizeIntake(
      [log({ food: RASAM, quantity_g: 4, quantity_unit: "bowl", calories: 168 })],   // 600 g × 400 mg/100 g = 2400 mg
      "2026-09-22", "2026-09-22",
    );
    const flags = evaluateLabs({ creatinine: { value: 1.8, ref: null, date: null } }, { intake: salty, needs, foods: [] });
    assert.equal(flags[0].readings[0].status, "high");
    assert.match(flags[0].intakeNote ?? "", /2400 mg of sodium a day, above the 2000 mg limit/);
  });
});

// ── Narration ─────────────────────────────────────────────────────
describe("narration", () => {
  const needs = computeNeeds(MOHAN, "2026-09-22");            // 2250 kcal, protein 58 g

  test("energy: share of target and the biggest macro gap", () => {
    const s = summarizeIntake([log({ calories: 961, protein_g: 28 })], "2026-09-22", "2026-09-22");
    const t = energyNarrative(s, needs);
    assert.match(t, /^Averaging 961 kcal a day, 43% of your 2,250 kcal target\./);
    assert.match(t, /is the biggest gap at \d+% of need\./);
    assert.equal(energyNarrative(summarizeIntake([], "2026-09-22", "2026-09-22"), needs), "No meals logged in this period.");
  });

  test("energy above target says so", () => {
    const s = summarizeIntake([log({ calories: 2700 })], "2026-09-22", "2026-09-22");
    assert.match(energyNarrative(s, needs), /20% above your 2,250 kcal target/);
  });

  test("vitamins and minerals name the two lowest and the sodium status", () => {
    const s = summarizeIntake([log({ food: SPINACH, quantity_g: 1, quantity_unit: "bowl", calories: 35 })], "2026-09-22", "2026-09-22");
    assert.match(microNarrative(s, needs), /^Lowest: vitamin B12 \(0%\) and /);
    assert.match(microNarrative(s, needs), /Sodium is within your limit\.$/);
  });

  test("trend counts logged days, the highest day and days near target", () => {
    const t = trendNarrative(
      [{ date: "2026-09-20", kcal: 1230 }, { date: "2026-09-21", kcal: 0 }, { date: "2026-09-22", kcal: 800 }], 2250);
    assert.equal(t, "Food logged on 2 of 3 days. Highest: 1,230 kcal on 20 Sept. No day reached your 2,250 kcal target.");
    assert.match(trendNarrative([{ date: "2026-09-22", kcal: 2200 }], 2250), /1 day near target\./);
  });

  test("Ayurveda: leading taste, dosha pressure, heating or cooling", () => {
    const a = summarizeAyurveda([log({ food: RASAM, calories: 300 }), log({ food: RASAM, calories: 300 }), log({ food: IDLI, calories: 400 })], "pitta");
    const t = ayurvedaNarrative(a);
    assert.match(t, /leads at \d+%/);
    assert.match(t, /60% tends to aggravate Pitta/);
    assert.match(t, /mostly heating foods\.$/);
  });

  test("lab summary names the areas to work on", () => {
    const flags = evaluateLabs(
      { hba1c: { value: 6.6, ref: "<5.7", date: null }, ldl: { value: 155, ref: "<100", date: null }, vitamin_d: { value: 13, ref: "30-100", date: null } },
      { intake: null, needs, foods: [] });
    assert.equal(labNarrative(flags, true), "3 areas to work on through food: Blood sugar, Cholesterol & blood fats and Vitamin D.");
    assert.equal(labNarrative([], false), "No lab report yet.");
    assert.equal(labNarrative([], true), "All values in the latest report are within the normal range.");
  });
});

// ── Intelligence ──────────────────────────────────────────────────
describe("intelligence", async () => {
  const { evaluateIntelligence, medicationGroups } = await import("./intelligence.ts");
  const needs = computeNeeds(MOHAN, "2026-09-22");
  const REPORT = latestLabValues([{ report_date: "2026-08-20", extracted_values: {
    hba1c: 6.6, hba1c_ref: "<5.7", triglycerides: 150, triglycerides_ref: "30-149",
    ldl: 155, ldl_ref: "<100", crp: 9.8, crp_ref: "0.0-3.3",
    vitamin_d: 13.24, vitamin_d_ref: "30-100", vitamin_b12: 238, vitamin_b12_ref: "211-911",
  } }]);
  const period = (entries: LogEntry[]) => summarizeIntake(entries, "2026-09-16", "2026-09-22");

  test("medicines are recognised by generic and Indian brand names", () => {
    const g = medicationGroups(["Glycomet 500", "Thyronorm 50 mcg", "Telma 40", "pan 40"]);
    assert.deepEqual([...g.keys()].sort(), ["aceArb", "acidReducer", "metformin", "thyroid"]);
    assert.equal(g.get("metformin"), "Glycomet 500");
    assert.equal(medicationGroups(null).size, 0);
  });

  test("metformin + low-normal B12 test + low B12 intake is a 'watch'", () => {
    const entries = [log({ food: IDLI, calories: 260 })];
    const ev = evaluateIntelligence({ profile: { ...MOHAN, medications: ["metformin"] }, needs, intake: period(entries), entries, labs: REPORT });
    const m = ev.find((e) => e.id === "med-metformin-b12")!;
    assert.equal(m.severity, "watch");
    assert.ok(m.evidence.some((x) => /238 pg\/mL/.test(x)));
  });

  test("the user's real report produces the combined patterns", () => {
    const ev = evaluateIntelligence({ profile: MOHAN, needs, intake: period([]), entries: [], labs: REPORT });
    const ids = ev.map((e) => e.id);
    assert.ok(ids.includes("pattern-insulin-resistance"));
    assert.ok(ids.includes("pattern-sugar-cholesterol"));
    assert.ok(ids.includes("pattern-inflammation-metabolic"));
    assert.equal(ev[0].severity, "alert");                                // alerts first
  });

  test("allergy 'oily foods' flags fried dishes that were logged", () => {
    const VADA = food({ name: "Medu Vada", category: "snack", fat_g: 13.5 });
    const COCONUT = food({ name: "Coconut (fresh grated)", category: "other", fat_g: 33 });   // fatty, but not "oily food"
    const entries = [
      log({ food_name: "Medu Vada", food: VADA, calories: 260 }), log({ food: IDLI, calories: 130 }),
      log({ food_name: "Coconut (fresh grated)", food: COCONUT, quantity_g: 20, calories: 70 }),
    ];
    const ev = evaluateIntelligence({ profile: MOHAN, needs, intake: period(entries), entries, labs: {} });
    const a = ev.find((e) => e.category === "allergy")!;
    assert.equal(a.severity, "alert");
    assert.deepEqual(a.evidence, ["Logged: Medu Vada"]);
  });

  test("hypertension + salt over the limit is an alert; under the limit is silent", () => {
    const profile = { ...MOHAN, conditions: ["Hypertension"] };
    const salty = [log({ food: RASAM, quantity_g: 4, quantity_unit: "bowl", calories: 168 })];     // 2400 mg sodium
    assert.ok(evaluateIntelligence({ profile, needs, intake: period(salty), entries: salty, labs: {} }).some((e) => e.id === "cond-bp-salt"));
    const light = [log({ food: IDLI, calories: 130 })];
    assert.ok(!evaluateIntelligence({ profile, needs, intake: period(light), entries: light, labs: {} }).some((e) => e.id === "cond-bp-salt"));
  });

  test("sugar-lowering medicine notices skipped breakfasts", () => {
    const entries = [
      log({ logged_date: "2026-09-20", meal_slot: "lunch", calories: 400 }),
      log({ logged_date: "2026-09-21", meal_slot: "dinner", calories: 400 }),
      log({ logged_date: "2026-09-22", meal_slot: "breakfast", calories: 300 }),
    ];
    const ev = evaluateIntelligence({ profile: { ...MOHAN, medications: ["Amaryl 1mg"] }, needs, intake: period(entries), entries, labs: {} });
    const s = ev.find((e) => e.id === "med-sulfonylurea-meals")!;
    assert.equal(s.severity, "watch");
    assert.ok(s.evidence.includes("No breakfast logged on 2 of 3 logged days"));
  });

  test("nothing to say gives an empty list", () => {
    const quiet = { ...MOHAN, conditions: [], allergies: [], medications: [] };
    assert.deepEqual(evaluateIntelligence({ profile: quiet, needs, intake: period([]), entries: [], labs: {} }), []);
  });
});
