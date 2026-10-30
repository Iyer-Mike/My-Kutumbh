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

test("far more fresh stock than the household could use before it spoils is flagged for a recount", () => {
  const tomato = { library_key: "tomato", quantity: 4.71, unit: "kg" as const, low_when: null, stock_at: null, bought_on: null, use_within_days: 6, daily_use: 0.06 };
  assert.equal(estimate(tomato, {}, 3, "2026-10-29", "2026-10-29").suspect, true);
  assert.equal(estimate({ ...tomato, quantity: 1 }, {}, 3, "2026-10-29", "2026-10-29").suspect, false);
  // rice keeps a year: a big sack is fine
  const rice = { library_key: "rice-sona-masoori", quantity: 10, unit: "kg" as const, low_when: null, stock_at: null, bought_on: null, use_within_days: null, daily_use: null };
  assert.equal(estimate(rice, {}, 3, "2026-10-29", "2026-10-29").suspect, false);
});
