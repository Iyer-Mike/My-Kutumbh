// The kitchen library: one entry per thing an Indian kitchen buys, and the arithmetic that keeps
// the shelf honest without anyone weighing anything.
//
//   Stock today = last known stock − what the menu cooked since (recipes × family size)
//                                  − daily use × days, for things no dish accounts for
//
// Purchases (bills, "bought" ticks) and "how much is left" taps set a new known stock.

import { LIBRARY } from "./kitchen-library-data.ts";
import type { Kind, Unit } from "./pantry.ts";
import { toShelf } from "./units.ts";

export type LibraryItem = {
  key: string; name: string; alias: string[]; group: string; unit: Unit;
  pack: number; shelfDays: number; usePerPersonPerDay: number; coverDays: number; often: string;
};

export { LIBRARY };
export const LIBRARY_BY_KEY = new Map(LIBRARY.map((l) => [l.key, l]));

/** Where a library group sits on the shelf. */
export function shelfPlace(group: string): { category: string; kind: Kind } {
  switch (group) {
    case "Rice & Grains": return { category: "grain", kind: "staple" };
    case "Flours": return { category: "flour", kind: "staple" };
    case "Pulses & Millets": return { category: "dal", kind: "staple" };
    case "Dairy & Eggs": return { category: "dairy", kind: "fresh" };
    case "Vegetables":
    case "Leafy greens & herbs": return { category: "vegetable", kind: "fresh" };
    case "Fruits": return { category: "fruit", kind: "fresh" };
    case "Whole spices & seeds":
    case "Spice powders & masalas": return { category: "spice", kind: "sundry" };
    case "Oils & ghee": return { category: "oil", kind: "staple" };
    case "Nuts & dry fruits": return { category: "dry_fruit", kind: "staple" };
    default: return { category: "ready", kind: "staple" };
  }
}

// ── Names ─────────────────────────────────────────────────────

/** Whole phrases that mean another item in the library. */
const PHRASES: [RegExp, string][] = [
  [/\b(?:vegetable|refined|cooking|neutral|sunflower)\s+oil\b/g, "sunflower oil"],
  [/\b(?:plain|all[- ]purpose|refined)\s+flour\b/g, "maida"],
  [/\b(?:whole\s+)?wheat\s+flour\b/g, "wheat atta"],
  [/\bgram\s+flour\b|\bchickpea\s+flour\b/g, "besan"],
  [/\b(?:fine\s+)?semolina\b|\bsooji\b|\bsuji\b/g, "rava"],
  [/\bcorn\s*(?:starch|flour)\b/g, "corn flour"],
  [/\bchick\s*peas?\b|\bgarbanzo(?:\s+beans?)?\b|\bchole\b/g, "kabuli chana"],
  [/\bkidney\s+beans?\b/g, "rajma"],
  [/\bblack[- ]eyed\s+peas?\b/g, "lobia"],
  [/\bred\s+lentils?\b/g, "masoor dal"],
  [/\bspring\s+onions?\b|\bscallions?\b|\bgreen\s+onions?\b/g, "spring onion"],
  [/\bsmall\s+onions?\b|\bsambar\s+onions?\b|\bshallots?\b/g, "small onion"],
  [/\bbell\s+peppers?\b|\bred\s+peppers?\b|\byellow\s+peppers?\b/g, "bell pepper"],
  [/\bgreen\s+peppers?\b/g, "capsicum"],
  [/\blady'?s?\s+fingers?\b|\bokra\b/g, "bhindi"],
  [/\beggplants?\b|\baubergines?\b/g, "brinjal"],
  [/\bcilantro\b/g, "coriander leaves"],
  [/\b(?:fresh\s+)?coriander(?:\s+leaves)?\b(?!\s+(?:powder|seeds?))/g, "coriander leaves"],
  [/\bground\s+coriander\b/g, "coriander powder"],
  [/\bground\s+cumin\b/g, "cumin powder"],
  [/\bground\s+(?:black\s+)?pepper\b/g, "black pepper powder"],
  [/\bground\s+cinnamon\b/g, "cinnamon"],
  [/\bground\s+ginger\b|\bginger\s+powder\b/g, "dry ginger powder"],
  [/\b(?:yogh?urt|dahi)\b/g, "curd"],
  [/\bmethi\s+seeds\b/g, "fenugreek seeds"],
  [/\bcarom\s+seeds\b/g, "ajwain"],
  [/\bnigella\b/g, "kalonji"],
  [/\bhaldi\s+fresh\b|\bfresh\s+(?:haldi|turmeric)\b|\bkachi\s+haldi\b|\bturmeric\s+root\b/g, "kachi haldi"],
  [/\b(?:asafo?etida|hing)\b/g, "asafoetida"],
  [/\bturmeric\b(?!\s+(?:leaves|root))/g, "turmeric powder"],
  [/\b(?:red\s+)?chill?i(?:es)?\s+powder\b|\bchili\s+powder\b/g, "red chilli powder"],
  [/\bdried\s+red\s+chill?i(?:es|s)?\b|\bdry\s+red\s+chill?i(?:es|s)?\b|\bred\s+chill?i(?:es|s)?\b/g, "dry red chilli"],
  [/\bgreen\s+chill?i(?:es|s)?\b|\bgreen\s+chili(?:es)?\b/g, "green chilli"],
  [/(?<!black\s)(?<!green\s)\bcardamoms?(?:\s+pods?)?\b(?!\s+powder)/g, "green cardamom"],
  [/\bcashew(?:\s+nuts?)?s?\b/g, "cashews"],
  [/\bgroundnuts?\b/g, "peanuts"],
  [/\bfox\s*nuts?\b/g, "makhana"],
  [/\bjuice\s+of\s+\S+\s+(?:lemons?|limes?)\b|\b(?:lemon|lime)\s+juice\b|\blimes?\b/g, "lemon"],
  [/\bcoconut\s+milk\b/g, "coconut milk"],
  [/\b(?:grated|fresh|freshly\s+grated)\s+coconut\b/g, "coconut fresh"],
  [/\bfull[- ]fat\s+milk\b|\bwhole\s+milk\b/g, "milk"],
  [/\bfresh\s+cream\b|\bdouble\s+cream\b|\bcream\b/g, "fresh cream"],
  [/\bfrench\s+beans?\b|\bgreen\s+beans?\b/g, "french beans"],
  [/\bbottle\s+gourd\b|\blauki\b|\bloki\b/g, "bottle gourd"],
  [/\bcurry\s+leaf\b/g, "curry leaves"],
  [/\bmint\b(?:\s+leaves)?/g, "mint leaves"],
  [/\bspinach(?:\s+leaves)?\b/g, "spinach"],
];

/** Words a shop or a recipe adds that do not change what is bought. */
const NOISE = /\b(?:a\s+grade|grade\s+a|grade|premium|organic|fresh|freshly|local|loose|desi|deshi|hybrid|farm|select|special|regular|best|new|big|large|medium|chopped|finely|thinly|sliced|diced|minced|grated|soaked|rinsed|drained|crushed|roasted|toasted|peeled|cubed|halved|slit|whole|split|to\s+taste|for\s+\w+(?:\s+\w+)?|as\s+needed|optional|tbsp|tsp|tablespoons?|teaspoons?|cups?|kgs?|gms?|grams?|ml|ltrs?|litres?|liters?|pinch(?:es)?|inch(?:es)?|pieces?|pcs|nos|packets?|pkts?|packs?|pouch|bottles?|jars?|boxes|box)\b/g;

const SINGLE = (w: string) =>
  w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
  : w.length > 4 && w.endsWith("oes") ? w.slice(0, -2)
  : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;

/** A name reduced to the words that say what it is. */
export function normName(raw: string): string {
  let s = ` ${raw.toLowerCase()} `
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[^a-z' -]/g, " ")
    .replace(/-/g, " ");
  for (const [re, to] of PHRASES) s = s.replace(re, ` ${to} `);
  return s.replace(NOISE, " ").replace(/\s+/g, " ").trim();
}
const tokens = (s: string) => normName(s).split(" ").filter((w) => w.length > 1).map(SINGLE);

type Cand = { item: LibraryItem; words: string[]; full: string };
let CANDS: Cand[] | null = null;
function candidates(): Cand[] {
  if (CANDS) return CANDS;
  CANDS = [];
  for (const item of LIBRARY) {
    const names = new Set([item.name, item.name.replace(/\(.*?\)/g, " "), ...item.alias]);
    // "Mango (Alphonso)" is also "Alphonso mango"
    const m = item.name.match(/^(.*?)\s*\((.*?)\)$/);
    if (m) names.add(`${m[2]} ${m[1]}`);
    for (const n of names) {
      const words = tokens(n);
      if (words.length) CANDS.push({ item, words, full: words.join(" ") });
    }
  }
  return CANDS;
}

/** The library entry a bill line, a recipe line or a shelf name means — or null. */
/** Words that never name something to buy on their own. */
const ALONE = new Set(["water", "ice", "stock", "broth", "sauce", "batter", "dough", "seasoning", "garnish", "filling", "topping", "juice", "paste", "powder", "seed", "leave", "flour"]);

const PACKAGED = /\b(?:cookies?|biscuits?|cakes?|chocolates?|cand(?:y|ies)|toffees?|wafers?|rusks?|soaps?|detergents?|shampoos?|chips|kurkure)\b/i;

export function matchLibrary(name: string): LibraryItem | null {
  const want = tokens(name);
  if (!want.length) return null;
  if (want.every((w) => ALONE.has(w))) return null;
  // Biscuits made with cashews are not cashews
  if (PACKAGED.test(name)) return null;
  const full = want.join(" ");
  const set = new Set(want);
  let best: { item: LibraryItem; score: number } | null = null;
  for (const c of candidates()) {
    let score = 0;
    if (c.full === full) score = 100;
    else if (c.words.every((w) => set.has(w))) score = 50 + c.words.length * 6;       // the line names this item and more
    else if (want.every((w) => c.words.includes(w))) score = 40 - (c.words.length - want.length);  // the line is a shorter name for it
    if (score > (best?.score ?? 0)) best = { item: c.item, score };
  }
  return best?.item ?? null;
}

// ── Amounts ───────────────────────────────────────────────────

/** kg ↔ g, l ↔ ml, dozen ↔ piece; anything else does not convert. */
export function convert(qty: number, from: Unit | string | null, to: Unit | string | null): number | null {
  if (qty == null || !from || !to) return null;
  if (from === to) return qty;
  const base: Record<string, [string, number]> = {
    g: ["m", 1], kg: ["m", 1000], ml: ["v", 1], l: ["v", 1000], piece: ["c", 1], dozen: ["c", 12],
  };
  const f = base[from], t = base[to];
  if (f && t && f[0] === t[0]) return (qty * f[1]) / t[1];
  // In a kitchen a litre of curd and a kilo of curd are the same purchase
  if (f && t && f[0] !== "c" && t[0] !== "c") return (qty * f[1]) / t[1];
  return null;
}

/** Roughly what one of these weighs, for "2 onions" and "1 tomato". */
const PIECE_KG: Record<string, number> = {
  onion: 0.15, "small-onion-shallots": 0.015, potato: 0.15, tomato: 0.1, carrot: 0.1, beetroot: 0.15, radish: 0.2,
  "capsicum-green": 0.15, "bell-pepper-red-yellow": 0.15, brinjal: 0.1, cucumber: 0.2, "green-chilli": 0.005,
  cabbage: 0.8, cauliflower: 0.6, "sweet-potato": 0.2, "bottle-gourd": 0.7, zucchini: 0.2, ginger: 0.01, garlic: 0.004,
};

const FRAC: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.33, "⅔": 0.67, "⅛": 0.125 };
function num(s: string): number {
  s = s.trim();
  if (FRAC[s]) return FRAC[s];
  const mixed = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/);
  if (mixed) return Number(mixed[1]) + FRAC[mixed[2]];
  if (/^\d+\/\d+$/.test(s)) { const [a, b] = s.split("/").map(Number); return a / b; }
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  return Number(s);
}

const UNIT_RE = "kg|kgs|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|cups?|tbsp|tablespoons?|tsp|teaspoons?|pinch(?:es)?|inch(?:es)?|cm|cloves?|sprigs?|bunch(?:es)?|handfuls?|cans?|packets?|pieces?|pcs|nos?|leaves|stalks?";
const AMOUNT = new RegExp(`(\\d+\\s*[½¼¾⅓⅔⅛]|\\d+(?:\\.\\d+)?\\s*[-–]\\s*\\d+(?:\\.\\d+)?|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔⅛]|\\ba\\b|\\bone\\b|\\btwo\\b|\\bhalf\\b)\\s*(${UNIT_RE})?\\b`, "i");

/** How much of a library item one recipe line asks for, in that item's own unit, or null when it can't tell. */
export function lineAmount(line: string, item: LibraryItem): number | null {
  // "Tamarind — lemon-sized ball (soaked in 1 cup warm water)": the amount is after the dash,
  // and what is in brackets is how to prepare it, not how much
  const parts = line.split(/\s+[—–]\s+|\s+-\s+/);
  const l = (parts.length > 1 ? parts.slice(1).join(" ") : line).toLowerCase().replace(/\([^)]*\)/g, " ");
  if (/lemon[- ]sized/.test(l)) return convert(20, "g", item.unit);
  if (/\b(?:to taste|as needed|for (?:deep |shallow )?frying|to garnish|for garnish|to serve)\b/.test(l) && !/\d/.test(l)) {
    return defaultAmount(item);
  }
  if (/\bpinch\b/.test(l) && !/\d/.test(l)) return convert(0.3, "g", item.unit) ?? null;
  const m = l.match(AMOUNT);
  if (!m) return defaultAmount(item);
  const n = m[1] === "a" || m[1] === "one" ? 1 : m[1] === "two" ? 2 : m[1] === "half" ? 0.5 : num(m[1]);
  if (!isFinite(n) || n <= 0) return defaultAmount(item);
  const u = (m[2] ?? "").toLowerCase();
  const g = item.group;
  const powder = /powder|masala/.test(item.key) || g === "Spice powders & masalas";
  const seeds = g === "Whole spices & seeds";
  const liquid = item.unit === "l" || item.unit === "ml";
  const herb = item.unit === "bunch";

  let grams: number | null = null;     // in g (or ml for liquids)
  if (/^kgs?$/.test(u)) grams = n * 1000;
  else if (/^(?:g|gm|gms|grams?)$/.test(u)) grams = n;
  else if (/^(?:l|ltr|litres?|liters?)$/.test(u)) grams = n * 1000;
  else if (u === "ml") grams = n;
  else if (/^cups?$/.test(u)) {
    if (herb) return n * 0.5;
    grams = n * (liquid || g === "Dairy & Eggs" ? 240 : g === "Flours" ? 120 : g === "Nuts & dry fruits" ? 140 : 200);
  } else if (/^(?:tbsp|tablespoons?)$/.test(u)) {
    if (herb) return n * 0.05;
    grams = n * (liquid ? 15 : powder ? 7 : seeds ? 9 : 12);
  } else if (/^(?:tsp|teaspoons?)$/.test(u)) {
    if (herb) return n * 0.02;
    grams = n * (liquid ? 5 : powder ? 2.5 : 3);
  } else if (/^pinch/.test(u)) grams = n * 0.3;
  else if (/^inch/.test(u) || u === "cm") grams = n * (u === "cm" ? 4 : 10);
  else if (/^cloves?$/.test(u)) grams = item.key === "garlic" ? n * 4 : n * 0.2;
  else if (/^sprigs?$/.test(u)) return herb ? n * 0.1 : null;
  else if (/^bunch/.test(u)) return herb ? n : null;
  else if (/^handfuls?$/.test(u)) return herb ? n * 0.25 : convert(n * 30, "g", item.unit);
  else if (/^leaves$/.test(u)) return herb ? n * 0.01 : null;
  else if (/^cans?$/.test(u)) grams = n * 400;
  else if (/^packets?$/.test(u)) return n * item.pack;
  else {
    // "2 onions", "1 tomato", "8 curry leaves", "2 eggs"
    if (item.unit === "piece") return n;
    if (item.unit === "dozen") return n / 12;
    if (herb) return /leaves/.test(l) ? n * 0.01 : n * 0.1;
    const kg = PIECE_KG[item.key];
    if (kg) return convert(n * kg, "kg", item.unit);
    if (g === "Whole spices & seeds") return convert(n * 0.5, "g", item.unit);   // "4 cloves", "2 bay leaves"
    return null;
  }
  return convert(grams, liquid ? "ml" : "g", item.unit);
}

/** A line with no amount ("onion, chopped"): what a family pot of it usually takes. */
function defaultAmount(item: LibraryItem): number | null {
  if (item.unit === "bunch") return 0.25;
  if (item.unit === "piece") return 1;
  const kg = PIECE_KG[item.key];
  if (kg) return convert(kg, "kg", item.unit);
  if (item.group === "Spice powders & masalas" || item.group === "Whole spices & seeds") return convert(1, "g", item.unit);
  if (item.group === "Oils & ghee") return convert(20, "ml", item.unit);
  return null;
}

/** "Serves 4", "4", "4–6" → 4. */
export function servesOf(s: string | null | undefined): number {
  const m = (s ?? "").match(/(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : NaN;
  return isFinite(n) && n > 0 && n <= 50 ? n : 4;
}

// ── What the menu used ────────────────────────────────────────

export type MenuDish = { date: string; serves: string | null; ingredients: string[] };
/** For each library item: what the cooked menu used, day by day, in the item's library unit. */
export type MenuUse = Record<string, { date: string; qty: number }[]>;

export function menuUse(dishes: MenuDish[], familySize: number): MenuUse {
  const out: MenuUse = {};
  for (const d of dishes) {
    const scale = Math.max(familySize, 1) / servesOf(d.serves);
    for (const line of d.ingredients ?? []) {
      const name = line.split(/\s+[—–]\s+|\s+-\s+/)[0];
      const item = matchLibrary(name) ?? matchLibrary(line);
      if (!item) continue;
      const q = lineAmount(line, item);
      if (q == null || !(q > 0)) continue;
      (out[item.key] ??= []).push({ date: d.date, qty: q * scale });
    }
  }
  return out;
}

// ── The estimate ──────────────────────────────────────────────

export type ShelfLike = {
  library_key: string | null; quantity: number | null; unit: Unit | null; low_when: number | null;
  stock_at: string | null; bought_on: string | null; use_within_days: number | null; daily_use: number | null;
  supply_every?: number | null;     // set when it is delivered regularly: never counted down, never short
};

export type Estimate = {
  est: number | null;          // what is probably left, in the shelf item's unit
  buyBelow: number | null;     // BUY when the estimate is at or below this
  daysLeftFresh: number | null;// days before it should be used (negative: past its days)
  short: boolean;              // goes on the list
  reason: "low" | "out" | "stale" | null;
  byMenu: boolean;             // the menu accounts for its use
  suspect?: boolean;           // more than the household could use before it spoils: probably a wrong count
};

const dayDiff = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);

export function estimate(item: ShelfLike, use: MenuUse, familySize: number, today: string, anchorDay: string | null): Estimate {
  const lib = item.library_key ? LIBRARY_BY_KEY.get(item.library_key) : undefined;
  const unit = item.unit ?? lib?.unit ?? null;
  const fam = Math.max(familySize, 1);

  // Delivered on a rhythm (milk, curd): the supply is the stock, so it is never short
  if (item.supply_every) {
    return { est: null, buyBelow: null, daysLeftFresh: null, short: false, reason: null, byMenu: false };
  }

  // Freshness: days since it was bought against how long it keeps
  const shelf = item.use_within_days ?? lib?.shelfDays ?? null;
  const daysLeftFresh = item.bought_on && shelf ? shelf - dayDiff(item.bought_on, today) : null;

  if (item.quantity == null || !unit) {
    return { est: null, buyBelow: null, daysLeftFresh, short: false, reason: null, byMenu: false };
  }

  const since = anchorDay ?? today;
  const menu = lib ? (use[lib.key] ?? []) : [];
  const byMenu = menu.length > 0;
  let used = 0;
  if (byMenu) {
    for (const u of menu) if (u.date > since && u.date <= today) used += convert(u.qty, lib!.unit, unit) ?? 0;
  } else {
    const rate = item.daily_use ?? (lib ? convert(lib.usePerPersonPerDay * fam, lib.unit, unit) : null);
    if (rate) used = rate * Math.max(dayDiff(since, today), 0);
  }
  const est = Math.max(0, Math.round((item.quantity - used) * 1000) / 1000);

  const libBuy = lib ? convert(lib.usePerPersonPerDay * fam * lib.coverDays, lib.unit, unit) : null;
  const buyBelow = item.low_when ?? (libBuy != null ? Math.round(libBuy * 1000) / 1000 : null);

  const out = est <= 0;
  const low = buyBelow != null && est <= buyBelow;
  // Something that keeps a month or less and is past its days has most likely been used or spoilt
  const stale = daysLeftFresh != null && daysLeftFresh < 0 && (shelf ?? 999) <= 30;
  const reason = out ? "out" : low ? "low" : stale ? "stale" : null;
  // A fresh thing cannot be used up slower than its days allow: far more than that is a counting slip
  const libRate = lib ? convert(lib.usePerPersonPerDay * fam, lib.unit, unit) : null;
  const rate = Math.max(item.daily_use ?? 0, libRate ?? 0);
  const suspect = rate > 0 && shelf != null && shelf <= 14 && est > rate * shelf * 3;
  return { est, buyBelow, daysLeftFresh, short: reason != null, reason, byMenu, suspect };
}

/** A bill's "1 packet" of something weighed: its usual pack, in the shelf unit. */
export function packToShelf(qty: number, unit: Unit | null, lib: LibraryItem, shelfUnit: Unit | null): number | null {
  const target = shelfUnit ?? lib.unit;
  if ((unit === "packet" || unit === "piece" || unit == null) && lib.unit !== "piece" && lib.unit !== "dozen" && lib.unit !== "bunch") {
    return convert(qty * lib.pack, lib.unit, target);
  }
  return unit ? (convert(qty, unit, target) ?? toShelf(qty, unit, target)) : null;
}
