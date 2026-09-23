// Reading a recipe's ingredient lines well enough to shop from.
// Two shapes cover almost every line:
//   "Toor dal — 1 cup"        the name, then the amount
//   "1 cup sambar (reheated)" the amount, then the name
// Anything else is taken as a name on its own.

const FRACTIONS = "½¼¾⅓⅔⅛";
const AMOUNT_HEAD = new RegExp(
  `^\\s*(?:[0-9][0-9.,/-]*|[${FRACTIONS}]|a|an|one|two|three|four|half)\\s*` +
  `(?:kg|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|cups?|tbsp|tsp|tablespoons?|teaspoons?|` +
  `pinch(?:es)?|handfuls?|bunch(?:es)?|cloves?|inch(?:es)?|pieces?|nos?|packets?|cans?|` +
  `sprigs?|stalks?|leaves|slices?|small|medium|large)?\\s+`,
  "i",
);

/** Words that describe the cutting, not the thing to buy. */
const PREP_WORDS = /\b(chopped|finely|thinly|sliced|diced|minced|grated|soaked|rinsed|drained|crushed|roasted|toasted|ground|peeled|deseeded|cubed|halved|quartered|shredded|julienned|boiled|cooked|fresh|dried|optional|to taste|for (?:cooking|garnish|tempering|frying|serving|deep frying)|as needed|plus more|reheated|from [^,]+)\b/gi;

const NOISE = /^(?:optional|toppings?|to serve|garnish|for the .*|others?)\s*[:\-]?\s*/i;

/** The thing you would actually buy, from one line of a recipe. */
export function ingredientName(line: string): string | null {
  let s = (line ?? "").trim();
  if (!s) return null;

  // "Name — 1 cup" → keep the left side; an amount-first line loses its head
  const dash = s.split(/\s+[—–]\s+| - /)[0];
  s = dash !== s ? dash : s.replace(AMOUNT_HEAD, "");

  s = s.replace(/\([^)]*\)/g, " ")          // (optional), (400g can)
       .replace(NOISE, " ")
       .replace(PREP_WORDS, " ")
       .replace(/\b\d+[\d.,/-]*\s*(?:kg|g|ml|l|cups?|tbsp|tsp)?\b/gi, " ")
       .replace(new RegExp(`[${FRACTIONS}]`, "g"), " ")
       .replace(/[,;:]+\s*$/, " ")
       .replace(/\s+/g, " ")
       .trim()
       .replace(/^(?:of|and|or)\s+/i, "")
       .replace(/^water\s+or\s+/i, "")           // "Water or stock" is a trip for stock
       .replace(/\s*[,&]\s.*$/, "")              // "cheese, cut into batons" is still cheese
       .replace(/\s+to\s+(?:garnish|finish|serve|top)$/i, "")
       .trim()
       .replace(/\s+(?:and|or|plus)$/i, "");

  if (s.length < 2) return null;
  if (/^(salt|water)$/i.test(s)) return null;        // nobody shops for these
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Every buyable name in a recipe, in order, without repeats. */
export function ingredientNames(lines: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines ?? []) {
    const name = ingredientName(line);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Loose match: "Toor dal" is on a shelf holding "Toor dal 1kg"; "Moong dal" is not. */
export function haveIt(name: string, shelfNames: string[]): boolean {
  const a = name.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!a) return false;
  return shelfNames.some((raw) => {
    const b = raw.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    if (!b) return false;
    if (a === b) return true;
    const long = a.length >= b.length ? a : b;
    const short = a.length >= b.length ? b : a;
    return short.length >= 4 && new RegExp(`\\b${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(long);
  });
}
