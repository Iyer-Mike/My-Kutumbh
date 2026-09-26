import type { CorrectionEvent, IntakeSummary, LabFlag, LogEntry, Needs, NutrientKey } from "./types";
import { isSugary } from "./labs.ts";

/**
 * From many findings to a few things to do.
 *
 * The old page gave every rule its own card, each ending in its own
 * advice. Five rules that share a cause — high sugar, diabetes, high
 * triglycerides, raised CRP, a lab reading — produced five sermons
 * saying "less sweets, more dal". A reader learns nothing from being
 * told one thing five ways; they simply stop reading.
 *
 * So findings no longer carry advice. They carry reasons. Reasons
 * gather under a small set of actions, and each action is stated once,
 * with a number attached: not "eat more fibre" but "about two more
 * katoris of dal a day — you are 15 g short of 34 g".
 *
 * Household measures, not percentages. Nobody serves a percentage.
 */

export type Action = {
  id: string;
  kind: "reduce" | "increase" | "avoid";
  /** The instruction, with its quantity. One sentence. */
  headline: string;
  /** Why — gathered from every finding that pointed here, deduplicated. */
  because: string[];
  /** How much this would move, for ranking. Higher first. */
  weight: number;
};

export type Gap = {
  label: string;
  /** What was eaten, in the nutrient's own unit. */
  had: number;
  /** Goal or limit. */
  target: number;
  kind: "goal" | "limit";
  unit: string;
  /** "15 g short" / "400 mg over" */
  gapText: string;
  /** The same gap in something you can put on a plate. */
  inFood: string | null;
  /** How far off, 0–1+, for ordering and for the bar. */
  share: number;
  /** True when an action above already says what to do about it. */
  covered: boolean;
};

/**
 * Small quantities keep their decimals. Vitamin B12 rounded to whole
 * numbers reads "1 of 3 mcg" when the truth is 0.6 of 2.2 — which is
 * not rounding, it is a different fact.
 */
const round = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const show = (n: number) => round(n).toLocaleString("en-IN");

/**
 * Typical Indian household portions. Approximate on purpose — a katori
 * varies from kitchen to kitchen — but far more use than a percentage.
 * Values are per serving as commonly eaten, from ICMR-NIN portion sizes.
 */
const PORTION = {
  dalKatori:     { fibre: 5,  protein: 7,   kcal: 130 },  // 1 katori cooked dal, ~150 g
  vegKatori:     { fibre: 4,  protein: 2,   kcal: 80  },  // 1 katori cooked vegetables
  curdKatori:    { calcium: 200, protein: 5, b12: 0.4 },  // 1 katori curd, ~150 g
  milkCup:       { calcium: 300, protein: 8, b12: 1.2 },  // 1 cup milk, ~200 ml
  banana:        { potassium: 350 },
  teaspoonSalt:  { sodium: 2000 },                         // ~5 g salt
} as const;

/** "about 2" — never "1.7", which nobody can serve. */
function servings(gap: number, per: number): number {
  return Math.max(1, Math.round(gap / per));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The gaps worth mentioning: what was eaten against what is needed,
 * and the difference in food. Only the ones actually off — a page that
 * lists twelve nutrients to say two are short is a page nobody reads.
 */
export function findGaps(intake: IntakeSummary, needs: Needs): Gap[] {
  const gaps: Gap[] = [];

  const add = (
    key: NutrientKey,
    label: string,
    unit: string,
    inFood: (gap: number) => string | null,
    tolerance = 0.85,
  ) => {
    const target = needs[key]?.value ?? 0;
    const had = intake.perDay[key] ?? 0;
    if (!target) return;
    const kind = needs[key].kind;
    const share = had / target;

    // A goal is a floor, a limit is a ceiling. Neither needs mentioning
    // when it is comfortably met.
    if (kind === "goal" && share >= tolerance) return;
    if (kind === "limit" && share <= 1) return;

    const gap = kind === "goal" ? target - had : had - target;
    gaps.push({
      label,
      had: round(had),
      target: round(target),
      kind,
      unit,
      gapText: `${show(gap)} ${unit} ${kind === "goal" ? "short" : "over"}`,
      inFood: inFood(gap),
      share,
      covered: false,
    });
  };

  add("fiber_g", "Fibre", "g", (g) => {
    const dal = servings(g, PORTION.dalKatori.fibre);
    return dal <= 3
      ? `about ${plural(dal, "katori", "katoris")} more dal a day`
      : `about 2 more katoris of dal and ${plural(servings(g - 2 * PORTION.dalKatori.fibre, PORTION.vegKatori.fibre), "katori", "katoris")} of vegetables a day`;
  });

  add("protein_g", "Protein", "g", (g) => {
    const dal = servings(g, PORTION.dalKatori.protein);
    return `curd, sprouts or paneer through the day — about ${plural(dal, "katori", "katoris")} of dal's worth`;
  });

  add("calcium_mg", "Calcium", "mg", (g) => {
    const cups = servings(g, PORTION.milkCup.calcium);
    return `about ${plural(cups, "cup", "cups")} more milk or curd a day`;
  });

  add("vitamin_b12_mcg", "Vitamin B12", "mcg", (g) => {
    const cups = servings(g, PORTION.milkCup.b12);
    return cups <= 3
      ? `about ${plural(cups, "cup", "cups")} more milk or curd a day`
      : "more than food alone can give — worth asking your doctor";
  });

  add("potassium_mg", "Potassium", "mg", (g) => {
    const n = servings(g, PORTION.banana.potassium);
    return n <= 4 ? `about ${plural(n, "banana", "bananas")} worth — or coconut water, spinach, tomato` : "more fruit and vegetables at every meal";
  });

  add("iron_mg", "Iron", "mg", () => "greens, ragi and jaggery with something sour for absorption");

  add("sodium_mg", "Salt", "mg", (g) => {
    const tsp = g / PORTION.teaspoonSalt.sodium;
    return tsp >= 0.25
      ? `about ${tsp < 0.75 ? "half a teaspoon" : plural(Math.round(tsp), "teaspoon", "teaspoons")} of salt a day less`
      : "a little less salt, and fewer pickles and papad";
  });

  return gaps.sort((a, b) => Math.abs(1 - b.share) - Math.abs(1 - a.share));
}

/**
 * Which action each finding argues for. One finding may argue for two;
 * several findings usually argue for the same one. That is the point.
 */
const ARGUES_FOR: { match: RegExp; actions: string[] }[] = [
  { match: /^cond-diabetes-carbs$/,            actions: ["less-sugar", "more-fibre"] },
  { match: /^pattern-insulin-resistance$/,     actions: ["less-sugar", "more-fibre"] },
  { match: /^pattern-sugar-cholesterol$/,      actions: ["less-sugar", "less-fried", "more-fibre"] },
  { match: /^pattern-inflammation-metabolic$/, actions: ["less-fried", "more-fibre"] },
  { match: /^cond-cholesterol-fried$/,         actions: ["less-fried"] },
  { match: /^cond-bp-salt$/,                   actions: ["less-salt"] },
  { match: /^pattern-bone$/,                   actions: ["more-calcium"] },
  { match: /^pattern-iron-anaemia$/,           actions: ["more-iron"] },
  { match: /^med-metformin-b12$/,              actions: ["more-b12"] },
  { match: /^med-diuretic-potassium$/,         actions: ["more-potassium"] },
];

/**
 * Lab findings argue for actions too, by the group evaluateLabs puts
 * them in. Readings with no group of their own are keyed by their own
 * name — vitamin_d, vitamin_b12, calcium.
 */
const LAB_ARGUES_FOR: Record<string, string[]> = {
  sugar:        ["less-sugar", "more-fibre"],
  lipids:       ["less-fried", "more-fibre"],
  inflammation: ["less-fried", "more-fibre"],
  iron:         ["more-iron"],
  calcium:      ["more-calcium"],
  vitamin_d:    ["more-calcium"],
  vitamin_b12:  ["more-b12"],
};

type Recipe = { kind: Action["kind"]; weight: number; say: (ctx: Ctx) => string };

type Ctx = {
  gaps: Map<string, Gap>;
  sweetsLogged: string[];
  friedLogged: string[];
  days: number;
};

/**
 * What each action says, once, with its number. The wording is built
 * from what this person actually ate, not from a template.
 */
const ACTIONS: Record<string, Recipe> = {
  "less-sugar": {
    kind: "reduce",
    weight: 100,
    say: ({ sweetsLogged, days }) => {
      const n = sweetsLogged.length;
      if (!n) return "Keep sweets and sugary drinks to a small portion once or twice a week.";
      const perWeek = Math.round((n / Math.max(days, 1)) * 7);
      return `Cut sweets to one or two a week — you logged ${plural(n, "sweet item", "sweet items")}${
        days >= 7 ? ` in ${days} days` : ""
      }${perWeek > 2 ? `, about ${perWeek} a week` : ""}.`;
    },
  },
  "less-fried": {
    kind: "reduce",
    weight: 90,
    say: ({ friedLogged }) =>
      friedLogged.length
        ? `Halve the fried snacks — ${plural(friedLogged.length, "was logged", "were logged")} this period. Idli in place of vada, roasted chana in place of mixture.`
        : "Keep fried snacks occasional; steamed and roasted instead.",
  },
  "more-fibre": {
    kind: "increase",
    weight: 95,
    say: ({ gaps }) => {
      const g = gaps.get("Fibre");
      return g
        ? `Add ${g.inFood} — you are averaging ${g.had} g against ${g.target} g.`
        : "Keep dal and vegetables at every meal.";
    },
  },
  "less-salt": {
    kind: "reduce",
    weight: 85,
    say: ({ gaps }) => {
      const g = gaps.get("Salt");
      return g ? `Use ${g.inFood} — pickles, papad and namkeen are where most of it hides.` : "Go easy on pickles, papad and salt at the table.";
    },
  },
  "more-calcium": {
    kind: "increase",
    weight: 70,
    say: ({ gaps }) => {
      const g = gaps.get("Calcium");
      return g ? `Add ${g.inFood} — you are averaging ${g.had} mg against ${g.target} mg. Ragi and sesame help too.` : "Curd or milk every day, and ragi or sesame through the week.";
    },
  },
  "more-b12": {
    kind: "increase",
    weight: 65,
    say: ({ gaps }) => {
      const g = gaps.get("Vitamin B12");
      return g ? `Add ${g.inFood}. B12 is hard to get from a vegetarian diet — worth mentioning to your doctor.` : "Curd, milk and paneer daily; B12 is scarce in vegetarian food.";
    },
  },
  "more-iron": {
    kind: "increase",
    weight: 60,
    say: () => "Greens, ragi and jaggery, with lemon or tomato alongside so the iron is absorbed.",
  },
  "more-potassium": {
    kind: "increase",
    weight: 55,
    say: ({ gaps }) => {
      const g = gaps.get("Potassium");
      return g ? `Add ${g.inFood} — you are averaging ${g.had} mg against ${g.target} mg.` : "Banana, coconut water, spinach and tomato through the week.";
    },
  },
};

export type Plan = {
  /** At most three things to do, strongest first. */
  actions: Action[];
  /** Things to avoid outright — allergies are never merged with advice. */
  avoid: Action[];
  /** What genuinely needs a doctor, not a change of diet. */
  doctor: string[];
  /** Everything that is off, with numbers. */
  gaps: Gap[];
};

export function planActions(input: {
  events: CorrectionEvent[];
  labFlags: LabFlag[];
  intake: IntakeSummary;
  needs: Needs;
  entries: LogEntry[];
}): Plan {
  const { events, labFlags, intake, needs, entries } = input;

  const gaps = findGaps(intake, needs);
  const byLabel = new Map(gaps.map((g) => [g.label, g]));

  const sweetsLogged = [...new Set(entries.filter((e) => e.food && isSugary(e.food)).map((e) => e.food_name))];
  const friedLogged = [...new Set(
    entries
      .filter((e) => /fry|fried|vada|bhaji|pakod|samosa|puri|chips|mixture|chevdo|jalebi/i.test(e.food_name))
      .map((e) => e.food_name),
  )];

  const ctx: Ctx = { gaps: byLabel, sweetsLogged, friedLogged, days: intake.days };

  // ── Gather the reasons under each action ──
  const reasons = new Map<string, Set<string>>();
  const note = (actionId: string, why: string) => {
    if (!ACTIONS[actionId]) return;
    if (!reasons.has(actionId)) reasons.set(actionId, new Set());
    reasons.get(actionId)!.add(why);
  };

  for (const e of events) {
    const rule = ARGUES_FOR.find((r) => r.match.test(e.id));
    if (!rule) continue;
    for (const a of rule.actions) note(a, e.title);
  }

  for (const f of labFlags) {
    const ids = LAB_ARGUES_FOR[f.key];
    if (!ids) continue;
    const highest = f.readings[0];
    const why = highest ? `${highest.label} ${highest.value} ${highest.unit}` : f.label;
    for (const a of ids) note(a, why);
  }

  // A gap large enough speaks for itself, even with no lab behind it
  for (const g of gaps) {
    if (g.share < 0.6 || (g.kind === "limit" && g.share > 1.2)) {
      const id = { Fibre: "more-fibre", Protein: "more-fibre", Calcium: "more-calcium",
                   "Vitamin B12": "more-b12", Potassium: "more-potassium", Iron: "more-iron",
                   Salt: "less-salt" }[g.label];
      if (id) note(id, `${g.label} ${g.gapText}`);
    }
  }

  const actions: Action[] = [...reasons.entries()]
    .map(([id, why]) => ({
      id,
      kind: ACTIONS[id].kind,
      headline: ACTIONS[id].say(ctx),
      // More findings pointing the same way makes an action more urgent
      weight: ACTIONS[id].weight + why.size * 5,
      because: [...why],
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // Allergies stand alone: they are not advice to balance, they are things
  // not to eat.
  const avoid: Action[] = events
    .filter((e) => e.category === "allergy")
    .map((e) => ({
      id: e.id,
      kind: "avoid" as const,
      headline: e.title,
      because: e.evidence,
      weight: 1000,
    }));

  // Only what a doctor must look at. Food cannot fix these.
  const doctor: string[] = [];
  for (const f of labFlags) {
    if (f.key === "inflammation") doctor.push("Raised CRP means inflammation somewhere. Ask your doctor to find the cause.");
    if (f.key === "vitamin_d") doctor.push("Vitamin D this low is rarely corrected by food alone — ask about a supplement.");
    if (f.key === "kidney" || f.key === "liver") doctor.push(`${f.label} readings are outside the range. This is one for your doctor, not the kitchen.`);
  }
  for (const e of events) {
    if (e.category === "medicine" && e.severity === "alert") doctor.push(e.detail);
  }

  // An action above already says what to do; the gap row below should
  // then give only the number, or the page repeats itself again.
  const COVERS: Record<string, string> = {
    "more-fibre": "Fibre", "more-calcium": "Calcium", "more-b12": "Vitamin B12",
    "more-potassium": "Potassium", "more-iron": "Iron", "less-salt": "Salt",
  };
  const spokenFor = new Set(actions.map((a) => COVERS[a.id]).filter(Boolean));
  for (const g of gaps) g.covered = spokenFor.has(g.label);

  return { actions, avoid, doctor: [...new Set(doctor)], gaps };
}
