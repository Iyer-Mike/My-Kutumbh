import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { approveLines, shelfLines, parseNumber } from "./bill-flow.ts";
import { billCheck, billAmount, monthReport } from "./spend.ts";

const draft = [
  { name: "  Toor dal ", quantity: "1", unit: "kg", category: "dal", price: "180", is_food: true },
  { name: "Surf", quantity: "", unit: "", category: "other", price: "95.5", is_food: false },
  { name: "", quantity: "2", unit: "kg", category: "grain", price: "50", is_food: true },       // blank name: dropped
  { name: "Milk", quantity: "abc", unit: "l", category: "dairy", price: "", is_food: true },    // bad qty, no price
];

describe("from a checked bill to what is recorded", () => {
  test("numbers are read strictly", () => {
    assert.equal(parseNumber("12.5"), 12.5); assert.equal(parseNumber(""), null);
    assert.equal(parseNumber("abc"), null); assert.equal(parseNumber("-3"), null);
  });
  test("corrections carry through; blank lines are dropped", () => {
    const a = approveLines(draft);
    assert.deepEqual(a.map((l) => l.name), ["Toor dal", "Surf", "Milk"]);
    assert.equal(a[0].quantity, 1); assert.equal(a[2].quantity, null); assert.equal(a[2].price, null);
  });
  test("household goes to spending only; food goes to both", () => {
    const a = approveLines(draft);
    assert.deepEqual(shelfLines(a).map((l) => l.name), ["Toor dal", "Milk"]);
    assert.equal(a[1].category, "household");
  });
  test("a meal eaten out is spending only", () => {
    const a = approveLines([
      { name: "Masala dosa", quantity: "2", unit: "", category: "eating_out", price: "160", is_food: false },
      { name: "Taxes and charges", quantity: "", unit: "", category: "eating_out", price: "8", is_food: false },
    ]);
    assert.deepEqual(a.map((l) => l.category), ["eating_out", "eating_out"]);
    assert.equal(shelfLines(a).length, 0);
    assert.equal(billCheck(a.map((l) => l.price), 168).ok, true);
  });
  test("the spending record and the shelf list come from the same lines", () => {
    const a = approveLines(draft);
    const onShelf = new Set(shelfLines(a).map((l) => l.name));
    assert.ok([...onShelf].every((n) => a.some((l) => l.name === n)));
  });
  test("the check, the bill amount and the month report agree", () => {
    const a = approveLines(draft);
    const chk = billCheck(a.map((l) => l.price), 275.5);
    assert.equal(chk.sum, 275.5); assert.equal(chk.ok, true); assert.equal(chk.missing, 1);
    const bill = { id: "b", bill_date: "2026-11-13", shop: "S", total: 275.5 };
    const lines = a.map((l) => ({ bill_id: "b", name: l.name, category: l.category, price: l.price, is_food: l.is_food }));
    assert.equal(billAmount(bill, lines), 275.5);
    const r = monthReport([bill], lines, "2026-11");
    assert.equal(r.total, 275.5);
    assert.equal(r.byCategory.reduce((s, c) => s + c.amount, 0), 275.5);   // categories add up to the bill when every line is priced... here Milk is unpriced
    assert.equal(r.unpriced, 1);
  });
});
