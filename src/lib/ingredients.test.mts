import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { haveIt, ingredientName, ingredientNames, sameThing } from "./ingredients.ts";

describe("reading an ingredient line", () => {
  test("name first, amount after the dash", () => {
    assert.equal(ingredientName("Toor dal — 1 cup"), "Toor dal");
    assert.equal(ingredientName("Basmati rice — 1 cup"), "Basmati rice");
    assert.equal(ingredientName("Olive oil — 4 tbsp"), "Olive oil");
  });

  test("the cutting is not the shopping", () => {
    assert.equal(ingredientName("Onions, thinly sliced — 3 large"), "Onions");
    assert.equal(ingredientName("Garlic, minced — 3 cloves"), "Garlic");
    assert.equal(ingredientName("Spinach or bitter leaf, chopped — 3 cups"), "Spinach or bitter leaf");
  });

  test("amount first", () => {
    assert.equal(ingredientName("1 cup sambar (reheated)"), "Sambar");
    assert.equal(ingredientName("6 idlis (from fermented batter)"), "Idlis");
    assert.equal(ingredientName("3 tbsp coconut chutney"), "Coconut chutney");
    assert.equal(ingredientName("4 tbsp ghee (optional)"), "Ghee");
  });

  test("tiny amounts and shelf basics are not shopping", () => {
    assert.equal(ingredientName("Oil — 2 tsp"), null);
    assert.equal(ingredientName("1 tsp ghee (optional)"), null);
    assert.equal(ingredientName("Turmeric powder — 1/2 tsp"), null);
    assert.equal(ingredientName("Turmeric powder — 1 cup"), null);
    assert.equal(ingredientName("Hing — a pinch"), null);
    assert.equal(ingredientName("Cumin seeds — 1 tbsp"), null);
    assert.equal(ingredientName("Cumin seeds — 3 tbsp"), "Cumin seeds");
    assert.equal(ingredientName("Water — 1 cup"), null);
  });

  test("what nobody shops for", () => {
    assert.equal(ingredientName("Salt — to taste"), null);
    assert.equal(ingredientName("Water or vegetable stock — 4 cups"), "Vegetable stock");
    assert.equal(ingredientName(""), null);
    assert.equal(ingredientName("   "), null);
  });

  test("a list keeps its order and drops repeats", () => {
    const names = ingredientNames([
      "Toor dal — 1 cup", "Salt — to taste", "Toor dal — extra", "Curry leaves — 10",
    ]);
    assert.deepEqual(names, ["Toor dal", "Curry leaves"]);
  });

  test("one chilli or many, it is one trip", () => {
    assert.deepEqual(
      ingredientNames(["Green chilli — 2", "Green chillies, slit — 3"]),
      ["Green chilli"],
    );
  });

  test("two things joined by 'and' are two things", () => {
    assert.deepEqual(
      ingredientNames(["Lemon juice and coriander to finish"]),
      ["Lemon juice", "coriander"],
    );
  });

  test("chili, chilly, chilli and chillies are one thing", () => {
    for (const w of ["Red chili", "Red chilly", "Red chillies", "Red chilli", "Red chilies"]) {
      assert.equal(sameThing(w), "red chilli");
    }
    assert.equal(sameThing("Yogurt"), sameThing("Curd"));
    assert.equal(sameThing("Curry leaves"), sameThing("Curry leaf"));
  });

  test("hot water and a curd starter are not bought", () => {
    for (const l of ["Hot water — 1 cup", "Warm water", "Cold water — as needed", "Boiling water"]) {
      assert.equal(ingredientName(l), null, l);
    }
    assert.equal(ingredientName("Yogurt starter culture — 1 tsp"), null);
    assert.equal(ingredientName("Rose water — 100 ml"), "Rose water");
    assert.equal(ingredientName("Coconut water — 1 cup"), "Coconut water");
  });

  test("water is never on the list", () => {
    assert.equal(ingredientName("Water to knead — as needed"), null);
    assert.equal(ingredientName("Water — 4 cups"), null);
  });
});

describe("is it on the shelf", () => {
  const shelf = ["Toor dal", "Rice", "Cooking oil", "Turmeric (haldi)"];

  test("the same thing, named a little differently", () => {
    assert.equal(haveIt("Toor dal", shelf), true);
    assert.equal(haveIt("Basmati rice", shelf), true);       // shelf has Rice
    assert.equal(haveIt("Turmeric", shelf), true);
  });

  test("a bracketed name on the shelf counts, and so does a spice's powder", () => {
    assert.equal(haveIt("Turmeric powder", shelf), true);
    assert.equal(haveIt("Haldi", shelf), true);
    assert.equal(haveIt("Red chilli powder", ["Red chilly powder"]), true);
    assert.equal(haveIt("Yogurt", ["Curd"]), true);
  });

  test("a different dal is not the same dal", () => {
    assert.equal(haveIt("Moong dal", shelf), false);
    assert.equal(haveIt("Drumstick", shelf), false);
    assert.equal(haveIt("", shelf), false);
  });
});
