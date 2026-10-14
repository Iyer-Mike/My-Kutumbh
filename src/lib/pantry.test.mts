import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isLow } from "./pantry.ts";

describe("when a shelf item turns red", () => {
  test("at or below its own low line", () => {
    assert.equal(isLow({ kind: "staple", status: "ok", quantity: 1, low_when: 1 }), true);
    assert.equal(isLow({ kind: "staple", status: "ok", quantity: 3, low_when: 1 }), false);
  });
  test("fresh things have a low line too", () => {
    assert.equal(isLow({ kind: "fresh", status: "ok", quantity: 0.5, low_when: 1 }), true);
  });
  test("a counted item with no line is low only when it has run out", () => {
    assert.equal(isLow({ kind: "fresh", status: "ok", quantity: 0, low_when: null }), true);
    assert.equal(isLow({ kind: "fresh", status: "ok", quantity: 2, low_when: null }), false);
  });
  test("anyone saying it is low makes it low; spices go by that alone", () => {
    assert.equal(isLow({ kind: "staple", status: "low", quantity: 9, low_when: 1 }), true);
    assert.equal(isLow({ kind: "sundry", status: "ok", quantity: null, low_when: null }), false);
    assert.equal(isLow({ kind: "sundry", status: "out", quantity: null, low_when: null }), true);
  });
});
