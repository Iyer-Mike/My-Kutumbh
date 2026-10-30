import test from "node:test";
import assert from "node:assert/strict";
import { estimate } from "./kitchen-library.ts";
import { supplyText, everyLabel } from "./supply.ts";

const milk = { library_key: "milk", quantity: 0, unit: "l" as const, low_when: 0.5, stock_at: null, bought_on: null, use_within_days: 3, daily_use: null };

test("a regularly supplied item is never short, however low the count", () => {
  assert.equal(estimate({ ...milk, supply_every: null }, {}, 4, "2026-10-30", null).short, true);
  const e = estimate({ ...milk, supply_every: 1 }, {}, 4, "2026-10-30", null);
  assert.equal(e.short, false);
  assert.equal(e.reason, null);
});
test("supply wording", () => {
  assert.equal(supplyText(1, "l", 1), "1 l every day");
  assert.equal(supplyText(0.5, "l", 2), "500 ml every 2 days");
  assert.equal(supplyText(null, "l", 7), "every week");
  assert.equal(everyLabel(5), "every 5 days");
});
