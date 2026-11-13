import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { allergyHit, cleanProposal, eligibleDishes, shelfHints, statusOf, strictestDiet, weeklyAverages, windowDates, type SuggestDish } from "./menu-suggest.ts";

const dish = (o: Partial<SuggestDish> & { id: string }): SuggestDish => ({
  name: o.id, category: "main", diet: "veg", meal_hint: null, calories: 100, protein_g: 5,
  serving_weight_g: 200, serving_unit: "plate", ingredients: null, kutumbh_id: null, ...o,
});

describe("menu suggestions", () => {
  test("a vegetarian Key Member's menu has no egg or meat dishes", () => {
    const list = [dish({ id: "a" }), dish({ id: "b", diet: "egg" }), dish({ id: "c", diet: "nonveg" }), dish({ id: "d", diet: "vegan" })];
    assert.deepEqual(eligibleDishes(list, ["vegetarian"], []).map((d) => d.id), ["a", "d"]);
  });
  test("any member's allergy removes the dish", () => {
    assert.equal(allergyHit({ name: "Peanut chutney", ingredients: null }, ["Peanuts"]), true);
    assert.equal(allergyHit({ name: "Curd rice", ingredients: "curd, rice" }, ["peanuts"]), false);
    const list = [dish({ id: "a", ingredients: "cashew, rice" }), dish({ id: "b" })];
    assert.deepEqual(eligibleDishes(list, ["vegetarian"], ["cashew"]).map((d) => d.id), ["b"]);
  });
  test("the strictest diet in the family decides", () => {
    const list = [dish({ id: "a" }), dish({ id: "b", diet: "egg" }), dish({ id: "c", diet: "nonveg" }), dish({ id: "d", diet: "vegan" })];
    assert.deepEqual(eligibleDishes(list, ["non-vegetarian", "vegetarian"], []).map((d) => d.id), ["a", "d"]);
    assert.deepEqual(eligibleDishes(list, ["vegetarian", "vegan"], []).map((d) => d.id), ["d"]);
    assert.equal(strictestDiet(["non-vegetarian", "vegan", null]), "vegan");
    assert.equal(strictestDiet([null]), null);
  });
  test("shelf hints: in, use soon, low", () => {
    const h = shelfHints([
      { name: "Rice", kind: "staple", status: "ok", bought_on: null, use_within_days: null },
      { name: "Spinach", kind: "fresh", status: "ok", bought_on: "2026-11-11", use_within_days: 5 },   // 3 days left
      { name: "Tomato", kind: "fresh", status: "ok", bought_on: "2026-11-09", use_within_days: 5 },    // 1 day left
      { name: "Curd", kind: "fresh", status: "ok", bought_on: "2026-11-01", use_within_days: 3 },      // long gone
      { name: "Toor dal", kind: "staple", status: "low", bought_on: null, use_within_days: null },
    ], "2026-11-13");
    assert.deepEqual(h.useSoon, ["Tomato"]); assert.deepEqual(h.low, ["Toor dal"]);
    assert.ok(h.have.includes("Rice") && h.have.includes("Spinach"));
  });
  test("seven days from the start", () => {
    assert.deepEqual(windowDates("2026-11-12", 3), ["2026-11-12", "2026-11-13", "2026-11-14"]);
    assert.equal(windowDates("2026-11-12").length, 7);
  });
  test("weekly averages are per day against each member's own Good Range", () => {
    // 2 plates a day × 7 days, each 200 g at 100 kcal/100 g = 200 kcal, protein 10 g
    const plan = windowDates("2026-11-12").flatMap((date) => [{ date, slot: "lunch", dishId: "a" }, { date, slot: "dinner", dishId: "a" }]);
    const map = new Map([["a", dish({ id: "a" })]]);
    const [x, y] = weeklyAverages(plan, map, [
      { id: "1", name: "A", kcal: 400, protein: 20 },
      { id: "2", name: "B", kcal: 1000, protein: 20 },
    ]);
    assert.equal(x.kcal, 400); assert.equal(x.kcalPct, 100); assert.equal(x.status, "good");
    assert.equal(y.kcalPct, 40); assert.equal(y.status, "off");
  });
  test("status bands", () => {
    assert.equal(statusOf(100), "good"); assert.equal(statusOf(85), "good");
    assert.equal(statusOf(75), "watch"); assert.equal(statusOf(140), "off");
  });
  test("the proposal keeps only empty slots and allowed dishes", () => {
    const allowed = new Map([["a", dish({ id: "a" })]]);
    const win = windowDates("2026-11-12", 2);
    const out = cleanProposal([
      { date: "2026-11-12", slot: "lunch", dish_ids: ["a", "zzz"], why: "x" },
      { date: "2026-11-12", slot: "dinner", dish_ids: ["a"], why: "filled" },
      { date: "2026-11-20", slot: "lunch", dish_ids: ["a"], why: "outside" },
      { date: "2026-11-13", slot: "lunch", dish_ids: ["zzz"], why: "unknown" },
    ], allowed, win, new Set(["2026-11-12|dinner"]));
    assert.deepEqual(out, [{ date: "2026-11-12", slot: "lunch", dishIds: ["a"], why: "x" }]);
  });
});
