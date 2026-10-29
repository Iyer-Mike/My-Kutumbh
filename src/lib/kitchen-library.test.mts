import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, matchLibrary, lineAmount, menuUse, estimate, packToShelf, LIBRARY_BY_KEY } from "./kitchen-library.ts";

const m = (n: string) => matchLibrary(n)?.name ?? null;
const near = (a: number | null, b: number, tol = 0.001) => assert.ok(a != null && Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

describe("the library", () => {
  test("is the standard Indian kitchen list, one entry per thing", () => {
    assert.ok(LIBRARY.length >= 300);
    assert.equal(new Set(LIBRARY.map((l) => l.key)).size, LIBRARY.length);
  });
});

describe("one name for one thing", () => {
  test("shop names, grades and Hindi names find the same entry", () => {
    assert.equal(m("Ginger (Deshi)"), "Ginger");
    assert.equal(m("Adrak"), "Ginger");
    assert.equal(m("Nimbu"), "Lemon");
    assert.equal(m("Lemon (A Grade)"), "Lemon");
    assert.equal(m("Shimla Mirch"), "Capsicum (green)");
    assert.equal(m("Patta Gobhi"), "Cabbage");
    assert.equal(m("Loki"), "Bottle gourd");
    assert.equal(m("Haldi"), "Turmeric powder");
    assert.equal(m("Hing"), "Asafoetida");
  });
  test("varieties stay apart", () => {
    assert.equal(m("Kesar Mango"), "Mango (Kesar)");
    assert.equal(m("Alphonso mango"), "Mango (Alphonso)");
    assert.equal(m("Gala Apple"), "Apple (Gala)");
    assert.equal(m("Black cardamom"), "Black cardamom");
  });
  test("water, and biscuits made with cashews, are not kitchen-library items", () => {
    assert.equal(m("water"), null);
    assert.equal(m("Cashew Cookies (Unibic)"), null);
  });
});

describe("how much a recipe line uses", () => {
  const amt = (line: string) => { const it = matchLibrary(line.split(/\s+[—–]\s+/)[0])!; return lineAmount(line, it); };
  test("cups, spoons and pieces become the item's own unit", () => {
    near(amt("Toor dal — 1/2 cup"), 0.1);            // kg
    near(amt("Cumin seeds — 1 tsp"), 3);              // g
    near(amt("Onion, chopped — 1"), 0.15);            // kg
    near(amt("Garlic — 4 cloves"), 0.016);            // kg
    near(amt("Paneer, cubed — 250 g"), 0.25);
  });
  test("what is in brackets is preparation, not amount", () => {
    near(amt("Tamarind — lemon-sized ball (soaked in 1 cup warm water)"), 20);   // g, not a cup
    near(amt("Drumstick — 1 (cut into 2 inch pieces)"), 1);
  });
});

describe("the menu drives the shelf", () => {
  const sambar = { date: "2026-10-20", serves: "4", ingredients: ["Toor dal — 1/2 cup", "Tomatoes — 2 (chopped)"] };
  test("a dish for 4 cooked for a family of 2 uses half", () => {
    const u = menuUse([sambar], 2);
    near(u["toor-dal"][0].qty, 0.05);
  });
  test("stock comes down by what was cooked after it was last known", () => {
    const u = menuUse([sambar, { ...sambar, date: "2026-10-22" }], 4);
    const e = estimate({ library_key: "toor-dal", quantity: 1, unit: "kg", low_when: null, stock_at: null,
      bought_on: "2026-10-19", use_within_days: null, daily_use: null }, u, 4, "2026-10-22", "2026-10-19");
    near(e.est, 0.8);
    assert.equal(e.byMenu, true);
  });
  test("something no dish uses comes down at its daily rate", () => {
    const e = estimate({ library_key: "milk", quantity: 2, unit: "l", low_when: null, stock_at: null,
      bought_on: "2026-10-20", use_within_days: null, daily_use: null }, {}, 4, "2026-10-21", "2026-10-20");
    near(e.est, 0.8);                    // 0.3 l a person a day × 4
    assert.equal(e.short, true);         // a day's cover for milk is 1.2 l
  });
  test("fresh things past their days go on the list even with some left", () => {
    const e = estimate({ library_key: "tomato", quantity: 3, unit: "kg", low_when: null, stock_at: null,
      bought_on: "2026-10-14", use_within_days: null, daily_use: 0.01 }, {}, 4, "2026-10-29", "2026-10-14");
    assert.equal(e.reason, "stale");
  });
});

describe("a bill's packet", () => {
  test("'1 packet' of dal is its usual pack by weight", () => {
    near(packToShelf(1, "packet", LIBRARY_BY_KEY.get("toor-dal")!, "kg"), 1);
    near(packToShelf(2, "packet", LIBRARY_BY_KEY.get("cumin-seeds")!, "g"), 200);
  });
});
