import test from "node:test";
import assert from "node:assert/strict";
import { bodyProblem } from "./body-check.ts";

const today = new Date("2026-10-30");
test("normal adult passes", () => assert.equal(bodyProblem({ heightCm: 160, weightKg: 60, dob: "1970-01-01" }, today), null));
test("120 cm / 60 kg adult is caught", () => assert.ok(bodyProblem({ heightCm: 120, weightKg: 60, dob: "1970-05-01" }, today)));
test("120 cm child is fine", () => assert.equal(bodyProblem({ heightCm: 120, weightKg: 22, dob: "2018-05-01" }, today), null));
test("empty is fine", () => assert.equal(bodyProblem({ heightCm: null, weightKg: null }, today), null));
test("out of range", () => { assert.ok(bodyProblem({ heightCm: 16, weightKg: 60 }, today)); assert.ok(bodyProblem({ heightCm: 170, weightKg: 700 }, today)); });
test("implausible bmi", () => assert.ok(bodyProblem({ heightCm: 190, weightKg: 20 }, today)));
