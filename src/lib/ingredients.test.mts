import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { haveIt, ingredientName, ingredientNames } from "./ingredients.ts";

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
    assert.equal(ingredientName("1 tsp ghee (optional)"), "Ghee");
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
});

describe("is it on the shelf", () => {
  const shelf = ["Toor dal", "Rice", "Cooking oil", "Turmeric (haldi)"];

  test("the same thing, named a little differently", () => {
    assert.equal(haveIt("Toor dal", shelf), true);
    assert.equal(haveIt("Basmati rice", shelf), true);       // shelf has Rice
    assert.equal(haveIt("Turmeric", shelf), true);
  });

  test("a different dal is not the same dal", () => {
    assert.equal(haveIt("Moong dal", shelf), false);
    assert.equal(haveIt("Drumstick", shelf), false);
    assert.equal(haveIt("", shelf), false);
  });
});
