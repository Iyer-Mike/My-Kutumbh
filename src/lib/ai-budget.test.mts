import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rupeesFor, checkBudget, MONTH_FAMILY_RUPEES, DAY_PERSON_RUPEES, MONTH_APP_RUPEES } from "./ai-budget.ts";

// A stand-in for the database: it answers with whatever rows we hand it.
// The gate asks two questions — the family's month, then the person's day.
function ledger(familyRows: number[], myRows: number[], appRupees = 0) {
  let call = 0;
  const rowsFor = () => (call++ === 0 ? familyRows : myRows).map((cost_rupees) => ({ cost_rupees }));
  const q = () => {
    const chain = {
      eq: () => chain,
      gte: () => Promise.resolve({ data: rowsFor() }),
    };
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: () => ({ select: q }), rpc: () => Promise.resolve({ data: appRupees }) } as any;
}

describe("what an answer costs", () => {
  test("Opus, a plain question", () => {
    // 10,000 in + 1,000 out = $0.05 + $0.025 = $0.075 → ₹6.75
    assert.equal(rupeesFor("claude-opus-5", { input_tokens: 10_000, output_tokens: 1_000 }), 6.75);
  });

  test("Haiku is a fifth of the price", () => {
    assert.equal(rupeesFor("claude-haiku-4-5-20251001", { input_tokens: 10_000, output_tokens: 1_000 }), 1.35);
  });

  test("a cached read costs a tenth, a cache write a quarter more", () => {
    const cheap = rupeesFor("claude-opus-5", { cache_read_input_tokens: 100_000 });
    const dear  = rupeesFor("claude-opus-5", { cache_creation_input_tokens: 100_000 });
    assert.equal(cheap, 4.5);      // $0.05 → ₹4.50
    assert.equal(dear, 56.25);     // $0.625 → ₹56.25
  });

  test("an unknown model is charged at the dearest rate we use", () => {
    const unknown = rupeesFor("claude-something-new", { input_tokens: 10_000, output_tokens: 1_000 });
    assert.equal(unknown, rupeesFor("claude-opus-5", { input_tokens: 10_000, output_tokens: 1_000 }));
  });

  test("a very small call still costs something, not nothing", () => {
    const tiny = rupeesFor("claude-haiku-4-5", { input_tokens: 1 });
    assert.ok(tiny > 0 && tiny < 0.001, `expected a hair above zero, got ${tiny}`);
  });

  test("a thousand small calls add up instead of vanishing", () => {
    const one = rupeesFor("claude-haiku-4-5", { input_tokens: 1_000, output_tokens: 200 });
    assert.ok(one * 1000 > 1, "small calls must accumulate");
  });

  test("nothing asked, nothing charged", () => {
    assert.equal(rupeesFor("claude-opus-5", {}), 0);
  });
});

describe("the ceiling", () => {
  test("lets an ordinary question through", async () => {
    const v = await checkBudget(ledger([10], [2]), "u1", "k1");
    assert.equal(v.ok, true);
  });

  test("stops the family for the month, in words they can act on", async () => {
    const v = await checkBudget(ledger([MONTH_FAMILY_RUPEES], [0]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /₹500 of AI for this month/);
    assert.match(v.message, /Menus, logging, the shopping list and recipes all carry on/);
    assert.equal(v.status, 429);
  });

  test("stops one person for the day without stopping the family", async () => {
    const v = await checkBudget(ledger([20], [DAY_PERSON_RUPEES]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /₹50 of AI for today/);
    assert.match(v.message, /rest of the family/);
  });

  test("the month is checked before the day, so the plainer reason is given first", async () => {
    const v = await checkBudget(ledger([MONTH_FAMILY_RUPEES], [DAY_PERSON_RUPEES]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /this month/);
  });

  test("a person with no family yet is counted on their own", async () => {
    const v = await checkBudget(ledger([], [1]), "u1", null);
    assert.equal(v.ok, true);
  });

  test("the whole app has a ceiling of its own, above every family", async () => {
    const v = await checkBudget(ledger([1], [0], MONTH_APP_RUPEES), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /across all the families/);
  });

  test("the app's ceiling is checked before any family's", async () => {
    const v = await checkBudget(ledger([MONTH_FAMILY_RUPEES], [0], MONTH_APP_RUPEES), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /across all the families/);
  });

  test("a missing app total does not stop an ordinary question", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noRpc = { ...ledger([1], [0]), rpc: () => Promise.resolve({ data: null }) } as any;
    const v = await checkBudget(noRpc, "u1", "k1");
    assert.equal(v.ok, true);
  });

  test("a ledger that cannot be read does not lock the family out", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const broken = { from: () => ({ select: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: null }) }) }) }), rpc: () => Promise.resolve({ data: null }) } as any;
    const v = await checkBudget(broken, "u1", "k1");
    assert.equal(v.ok, true);
  });
});
