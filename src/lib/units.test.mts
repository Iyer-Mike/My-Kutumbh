import test from "node:test";
import assert from "node:assert/strict";
import { friendly, naturalUnit, toShelf, unitChoices, looksTooMuch, categoryUnit } from "./units.ts";

test("friendly scales", () => {
  assert.equal(friendly(0.25, "kg"), "250 g");
  assert.equal(friendly(5, "kg"), "5 kg");
  assert.equal(friendly(1500, "g"), "1.5 kg");
  assert.equal(friendly(0.5, "l"), "500 ml");
  assert.equal(friendly(1, "dozen"), "1 dozen");
  assert.equal(friendly(0.5, "dozen"), "6 pieces");
  assert.equal(friendly(12, "piece"), "1 dozen");
  assert.equal(friendly(1, "bunch"), "1 bunch");
  assert.equal(friendly(0, "kg"), "0 kg");
  assert.equal(friendly(null, "kg"), "");
});
test("natural units", () => {
  assert.equal(naturalUnit("bunch"), "g");
  assert.equal(naturalUnit("kg", 5), "kg");
  assert.equal(naturalUnit("kg", 0.1), "g");
  assert.equal(naturalUnit("l", 0.5), "ml");
  assert.equal(naturalUnit("l", 1), "l");
  assert.equal(naturalUnit("piece", 12), "dozen");
  assert.equal(naturalUnit("piece", 6), "piece");
  assert.equal(naturalUnit("dozen", 1), "dozen");
});
test("choices and conversion", () => {
  assert.deepEqual(unitChoices("kg"), ["g", "kg"]);
  assert.deepEqual(unitChoices("bunch"), ["g", "bunch"]);
  assert.equal(toShelf(250, "g", "kg"), 0.25);
  assert.equal(toShelf(2, "kg", "g"), 2000);
  assert.equal(toShelf(200, "g", "bunch"), 2);
  assert.equal(toShelf(1, "bunch", "g"), 100);
  assert.equal(toShelf(6, "piece", "dozen"), 0.5);
  assert.equal(toShelf(1, "kg", "l"), null);
});
test("the 250 kg mistake is caught", () => {
  assert.equal(looksTooMuch(250, "kg"), true);
  assert.equal(looksTooMuch(0.25, "kg"), false);
  assert.equal(looksTooMuch(5, "kg"), false);
  assert.equal(looksTooMuch(60, "l"), true);
});
test("category defaults", () => { assert.equal(categoryUnit("spice"), "g"); assert.equal(categoryUnit("grain"), "kg"); assert.equal(categoryUnit("oil"), "l"); });
