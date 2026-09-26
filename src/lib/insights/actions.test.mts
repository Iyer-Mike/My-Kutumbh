import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planActions, findGaps } from "./actions.ts";
import type { CorrectionEvent, IntakeSummary, LabFlag, LogEntry, Needs } from "./types.ts";

const needs = (over: Partial<Record<string, { value: number; kind: "goal" | "limit" }>> = {}) =>
  ({
    kcal:             { value: 2250, kind: "goal",  source: "t" },
    protein_g:        { value: 58,   kind: "goal",  source: "t" },
    carbs_g:          { value: 300,  kind: "goal",  source: "t" },
    fat_g:            { value: 60,   kind: "goal",  source: "t" },
    fiber_g:          { value: 34,   kind: "goal",  source: "t" },
    iron_mg:          { value: 19,   kind: "goal",  source: "t" },
    calcium_mg:       { value: 1000, kind: "goal",  source: "t" },
    vitamin_b12_mcg:  { value: 2.2,  kind: "goal",  source: "t" },
    vitamin_c_mg:     { value: 80,   kind: "goal",  source: "t" },
    folate_mcg:       { value: 300,  kind: "goal",  source: "t" },
    sodium_mg:        { value: 2000, kind: "limit", source: "t" },
    potassium_mg:     { value: 3500, kind: "goal",  source: "t" },
    ...over,
  }) as unknown as Needs;

const intake = (per: Partial<Record<string, number>>): IntakeSummary =>
  ({
    days: 7, loggedDays: 6, items: 40,
    perDay: {
      kcal: 1715, protein_g: 50, carbs_g: 230, fat_g: 30, fiber_g: 19,
      iron_mg: 15, calcium_mg: 410, vitamin_b12_mcg: 0.6, vitamin_c_mg: 70,
      folate_mcg: 250, sodium_mg: 1500, potassium_mg: 1100, ...per,
    },
    daily: [], microCoverage: 0.9, estimatedShare: 0.1,
  }) as unknown as IntakeSummary;

const meal = (name: string): LogEntry =>
  ({ logged_date: "2026-09-20", meal_slot: "lunch", food_name: name, quantity_g: 100,
     quantity_unit: "g", calories: 200, protein_g: 5, nutrition_estimated: false,
     food: { name, category: "sweet", rasa: ["sweet"] } }) as unknown as LogEntry;

const event = (id: string, title: string, category = "condition"): CorrectionEvent =>
  ({ id, title, category, severity: "watch", detail: "", action: "", evidence: [] }) as CorrectionEvent;

const flag = (key: string, label: string, reading?: { label: string; value: number; unit: string }): LabFlag =>
  ({ key, label, known: true, meaning: "", favour: [], limit: [], nutrient: null,
     favourFoods: [], intakeNote: null,
     readings: reading ? [{ ...reading, key, status: "high", range: "" }] : [] }) as unknown as LabFlag;

describe("what is off, and by how much", () => {
  test("a shortfall is named in katoris, not percentages", () => {
    const gaps = findGaps(intake({ fiber_g: 19 }), needs());
    const fibre = gaps.find((g) => g.label === "Fibre");
    assert.ok(fibre, "fibre should be flagged");
    assert.equal(fibre.gapText, "15 g short");
    assert.match(fibre.inFood ?? "", /katori/);
  });

  test("what is comfortably met is not mentioned at all", () => {
    const gaps = findGaps(intake({ fiber_g: 33, vitamin_c_mg: 80 }), needs());
    assert.equal(gaps.find((g) => g.label === "Fibre"), undefined);
  });

  test("a limit is only mentioned when exceeded", () => {
    const under = findGaps(intake({ sodium_mg: 1500 }), needs());
    assert.equal(under.find((g) => g.label === "Salt"), undefined);

    const over = findGaps(intake({ sodium_mg: 3000 }), needs());
    const salt = over.find((g) => g.label === "Salt");
    assert.ok(salt);
    assert.equal(salt.gapText, "1000 mg over");
    assert.match(salt.inFood ?? "", /teaspoon/);
  });

  test("the worst gap is listed first", () => {
    const gaps = findGaps(intake({ fiber_g: 30, vitamin_b12_mcg: 0.1 }), needs());
    assert.equal(gaps[0].label, "Vitamin B12");
  });
});

describe("many findings, one instruction", () => {
  // The whole point: these five findings all argue for eating less
  // sugar. The reader should be told once.
  const fiveSugarFindings = [
    event("cond-diabetes-carbs", "Sugar and carbs with diabetes"),
    event("pattern-insulin-resistance", "High sugar and high triglycerides together", "pattern"),
    event("pattern-sugar-cholesterol", "Blood sugar and cholesterol are both high", "pattern"),
    event("pattern-inflammation-metabolic", "Inflammation alongside sugar or cholesterol", "pattern"),
  ];

  const plan = () =>
    planActions({
      events: fiveSugarFindings,
      labFlags: [
        flag("sugar", "Blood sugar", { label: "HbA1c", value: 6.6, unit: "%" }),
        flag("lipids", "Cholesterol & blood fats", { label: "LDL", value: 155, unit: "mg/dL" }),
        flag("inflammation", "Inflammation", { label: "CRP", value: 9.8, unit: "mg/L" }),
      ],
      intake: intake({}),
      needs: needs(),
      entries: [meal("Jalebi"), meal("Dates (dry)"), meal("Sapota (Chiku)")],
    });

  test("five findings about sugar become one instruction", () => {
    const sugar = plan().actions.filter((a) => a.id === "less-sugar");
    assert.equal(sugar.length, 1, "sugar must be said once, not five times");
  });

  test("and it carries a number from what was actually eaten", () => {
    const sugar = plan().actions.find((a) => a.id === "less-sugar");
    assert.ok(sugar);
    assert.match(sugar.headline, /\d/, "the instruction must quantify");
    assert.match(sugar.headline, /sweet item/);
  });

  test("every finding that argued for it is kept as a reason", () => {
    const sugar = plan().actions.find((a) => a.id === "less-sugar");
    assert.ok((sugar?.because.length ?? 0) >= 4, "the reasons are folded underneath, not thrown away");
    assert.ok(sugar?.because.some((b) => /HbA1c 6.6/.test(b)));
  });

  test("never more than three things to do", () => {
    assert.ok(plan().actions.length <= 3);
  });

  test("the most-argued-for action comes first", () => {
    const [first] = plan().actions;
    assert.ok(["less-sugar", "more-fibre"].includes(first.id), `got ${first.id}`);
  });
});

describe("what is not advice", () => {
  test("an allergy is never merged into general advice", () => {
    const p = planActions({
      events: [{ ...event("allergy-oily-foods", "Logged food that may not suit you: oily foods", "allergy"),
                 evidence: ["Logged: Medu Vada"] } as CorrectionEvent],
      labFlags: [], intake: intake({}), needs: needs(), entries: [],
    });
    assert.equal(p.avoid.length, 1);
    assert.equal(p.actions.find((a) => a.id.startsWith("allergy")), undefined);
  });

  test("what a doctor must see is kept out of the food advice", () => {
    const p = planActions({
      events: [], labFlags: [flag("inflammation", "Inflammation", { label: "CRP", value: 9.8, unit: "mg/L" })],
      intake: intake({}), needs: needs(), entries: [],
    });
    assert.equal(p.doctor.length, 1);
    assert.match(p.doctor[0], /doctor/);
  });

  test("the same doctor's note is not repeated", () => {
    const p = planActions({
      events: [], intake: intake({}), needs: needs(), entries: [],
      labFlags: [flag("inflammation", "Inflammation"), flag("inflammation", "Inflammation")],
    });
    assert.equal(p.doctor.length, 1);
  });
});

describe("a quiet week", () => {
  test("nothing logged and nothing wrong produces nothing to say", () => {
    const p = planActions({
      events: [], labFlags: [], entries: [], needs: needs(),
      intake: intake({ fiber_g: 34, protein_g: 58, calcium_mg: 1000, vitamin_b12_mcg: 2.2,
                       potassium_mg: 3500, iron_mg: 19, sodium_mg: 1500 }),
    });
    assert.equal(p.actions.length, 0);
    assert.equal(p.gaps.length, 0);
  });
});
