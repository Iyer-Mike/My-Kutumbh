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

/** A pinch, a dash, a few teaspoons or a spoon or two: kitchen-shelf quantities, never a trip to the shop. */
function isTinyAmount(line: string): boolean {
  const l = line.toLowerCase();
  if (/\b(?:pinch(?:es)?|dash(?:es)?|drops?|to taste|as needed)\b/.test(l)) return true;
  const m = l.match(/(\d+(?:\.\d+)?|\d+\/\d+|[\u00BD\u00BC\u00BE\u2153\u2154\u215B])\s*(tsp|teaspoons?|tbsp|tablespoons?)\b/);
  if (!m) return false;
  const frac: Record<string, number> = { "\u00BD": .5, "\u00BC": .25, "\u00BE": .75, "\u2153": .33, "\u2154": .67, "\u215B": .125 };
  const q = frac[m[1]] ?? (m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]));
  return /^t(?:sp|easpoon)/.test(m[2]) ? true : q <= 2;
}

/** Always on the kitchen shelf, whatever the amount. */
const SHELF_BASICS = /^(?:turmeric|haldi|hing|asafoetida|asafetida|baking soda|ice(?: cubes?)?)(?:\s+powder)?$/i;

/** The thing you would actually buy, from one line of a recipe. */
export function ingredientName(line: string): string | null {
  let s = (line ?? "").trim();
  if (!s) return null;
  if (isTinyAmount(s)) return null;

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
  if (SHELF_BASICS.test(s)) return null;
  if (/^salt$/i.test(s) || /^water\b/i.test(s)) return null;   // nobody shops for these
  // Hot, warm, cold or boiling water comes from the tap; coconut or rose water is a different thing
  if (/^(?:hot|warm|lukewarm|luke warm|cold|chilled|boiling|ice|iced|tap|drinking|filtered|plain)\s+water\b/i.test(s)) return null;
  // A spoon of last batch's curd is the starter: it is not bought
  if (/\b(?:starter|culture)(?:\s+culture)?$/i.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Lemon juice and coriander" is two trips to the shop, not one. */
function splitAnd(name: string): string[] {
  const parts = name.split(/\s+and\s+/i).map((p) => p.trim()).filter((p) => p.length >= 3);
  return parts.length === 2 && parts.every((p) => p.length <= 20) ? parts : [name];
}

/** Plural or not, chilli or chillies, it is the same trip. */
// "es" before "s", so chillies → chilli (not chill) and tomatoes → tomato
// Spellings that are the same thing in a kitchen come first, then the plural is dropped.
export const sameThing = (s: string) =>
  s.toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z ]/g, "")
    .replace(/\bchill?(?:y|i|ie|ies|e|es)\b/g, "chilli")     // chili, chilly, chilli, chillies, chile
    .replace(/\b(?:yoghurt|yogurt|dahi)\b/g, "curd")
    .replace(/\bcilantro\b/g, "coriander")
    .replace(/\bleaves\b/g, "leaf")
    .replace(/\b(\w{2,}?)(?:es|s)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

/** Every buyable name in a recipe, in order, without repeats. */
export function ingredientNames(lines: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines ?? []) {
    const parsed = ingredientName(line);
    if (!parsed) continue;
    for (const name of splitAnd(parsed)) {
      const key = sameThing(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

/** Loose match: "Toor dal" is on a shelf holding "Toor dal 1kg"; "Moong dal" is not. */
export function haveIt(name: string, shelfNames: string[]): boolean {
  const a = sameThing(name);
  if (!a) return false;
  // "Turmeric (haldi)" is turmeric, and haldi
  const forms = shelfNames.flatMap((raw) => [raw, ...[...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])]);
  return forms.some((raw) => {
    const b = sameThing(raw);
    if (!b) return false;
    if (a === b) return true;
    const long = a.length >= b.length ? a : b;
    const short = a.length >= b.length ? b : a;
    return short.length >= 3 && new RegExp(`\\b${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(long);
  });
}
