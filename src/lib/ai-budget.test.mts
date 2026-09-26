import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { paiseFor, checkBudget, MONTH_FAMILY_PAISE, DAY_PERSON_PAISE } from "./ai-budget.ts";

// A stand-in for the database: it answers with whatever rows we hand it.
// The gate asks two questions — the family's month, then the person's day.
function ledger(familyRows: number[], myRows: number[]) {
  let call = 0;
  const rowsFor = () => (call++ === 0 ? familyRows : myRows).map((paise) => ({ paise }));
  const q = () => {
    const chain = {
      eq: () => chain,
      gte: () => Promise.resolve({ data: rowsFor() }),
    };
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: () => ({ select: q }) } as any;
}

describe("what an answer costs", () => {
  test("Opus, a plain question", () => {
    // 10,000 in + 1,000 out = $0.05 + $0.025 = $0.075 → ₹6.75 → 675 paise
    assert.equal(paiseFor("claude-opus-5", { input_tokens: 10_000, output_tokens: 1_000 }), 675);
  });

  test("Haiku is a fifth of the price", () => {
    assert.equal(paiseFor("claude-haiku-4-5-20251001", { input_tokens: 10_000, output_tokens: 1_000 }), 135);
  });

  test("a cached read costs a tenth, a cache write a quarter more", () => {
    const cheap = paiseFor("claude-opus-5", { cache_read_input_tokens: 100_000 });
    const dear  = paiseFor("claude-opus-5", { cache_creation_input_tokens: 100_000 });
    assert.equal(cheap, 450);    // $0.05 → ₹4.50
    assert.equal(dear, 5_625);   // $0.625 → ₹56.25
  });

  test("an unknown model is charged at the dearest rate we use", () => {
    const unknown = paiseFor("claude-something-new", { input_tokens: 10_000, output_tokens: 1_000 });
    assert.equal(unknown, paiseFor("claude-opus-5", { input_tokens: 10_000, output_tokens: 1_000 }));
  });

  test("a fraction of a paisa still counts as one", () => {
    assert.equal(paiseFor("claude-haiku-4-5", { input_tokens: 1 }), 1);
  });

  test("nothing asked, nothing charged", () => {
    assert.equal(paiseFor("claude-opus-5", {}), 0);
  });
});

describe("the ceiling", () => {
  test("lets an ordinary question through", async () => {
    const v = await checkBudget(ledger([1_000], [200]), "u1", "k1");
    assert.equal(v.ok, true);
  });

  test("stops the family for the month, in words they can act on", async () => {
    const v = await checkBudget(ledger([MONTH_FAMILY_PAISE], [0]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /₹500 of AI for this month/);
    assert.match(v.message, /Menus, logging, the shopping list and recipes all carry on/);
    assert.equal(v.status, 429);
  });

  test("stops one person for the day without stopping the family", async () => {
    const v = await checkBudget(ledger([2_000], [DAY_PERSON_PAISE]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /₹50 of AI for today/);
    assert.match(v.message, /rest of the family/);
  });

  test("the month is checked before the day, so the plainer reason is given first", async () => {
    const v = await checkBudget(ledger([MONTH_FAMILY_PAISE], [DAY_PERSON_PAISE]), "u1", "k1");
    assert.equal(v.ok, false);
    if (v.ok) return;
    assert.match(v.message, /this month/);
  });

  test("a person with no family yet is counted on their own", async () => {
    const v = await checkBudget(ledger([], [100]), "u1", null);
    assert.equal(v.ok, true);
  });

  test("a ledger that cannot be read does not lock the family out", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const broken = { from: () => ({ select: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: null }) }) }) }) } as any;
    const v = await checkBudget(broken, "u1", "k1");
    assert.equal(v.ok, true);
  });
});
