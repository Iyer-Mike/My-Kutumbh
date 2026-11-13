import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addMonths, billCheck, billAmount, daysInMonth, monthReport } from "./spend.ts";

const bills = [
  { id: "1", bill_date: "2026-11-02", shop: "Big Bazaar", total: 500 },
  { id: "2", bill_date: "2026-11-10", shop: "Big Bazaar", total: null },
  { id: "3", bill_date: "2026-10-30", shop: null, total: 100 },
];
const lines = [
  { bill_id: "1", name: "Toor dal", category: "dal", price: 300, is_food: true },
  { bill_id: "1", name: "Soap", category: "other", price: 200, is_food: false },
  { bill_id: "2", name: "Milk", category: "dairy", price: 60, is_food: true },
  { bill_id: "2", name: "Mystery", category: "other", price: null, is_food: true },
  { bill_id: "3", name: "Rice", category: "grain", price: 100, is_food: true },
];

describe("bill spending", () => {
  test("lines that add up to the total pass; a big gap is flagged", () => {
    assert.equal(billCheck([300, 200], 500).ok, true);
    assert.equal(billCheck([300, 100], 500).ok, false);
    assert.equal(billCheck([300, 100], 500).diff, 100);
    assert.equal(billCheck([100, null], null).ok, true);
    assert.equal(billCheck([100, null], null).missing, 1);
  });
  test("a bill's amount is its total, else its lines", () => {
    assert.equal(billAmount(bills[0], lines), 500);
    assert.equal(billAmount(bills[1], lines), 60);
  });
  test("a month adds up bills, categories and shops", () => {
    const r = monthReport(bills, lines, "2026-11");
    assert.equal(r.bills, 2); assert.equal(r.total, 560);
    assert.deepEqual(r.byShop, [{ shop: "Big Bazaar", amount: 560 }]);
    assert.deepEqual(r.byCategory.map((c) => c.category), ["dal", "other", "dairy"]);
    assert.equal(r.unpriced, 1);
  });
  test("months roll over", () => {
    assert.equal(addMonths("2026-12", 1), "2027-01");
    assert.equal(addMonths("2026-01", -1), "2025-12");
    assert.equal(daysInMonth("2026-02"), 28);
  });
});
