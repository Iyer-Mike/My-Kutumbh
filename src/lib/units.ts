// Buying and shelf amounts in the unit the thing is actually bought in:
// herbs by the gram, rice by the kilo, bananas by the dozen, oil by the litre.
import type { Unit } from "./pantry.ts";

export type UnitFamily = "mass" | "volume" | "count" | "bunch" | "packet";

/** A bunch of coriander, mint or curry leaves, roughly. */
export const GRAMS_PER_BUNCH = 100;

export function familyOf(u: Unit | null | undefined): UnitFamily | null {
  if (u === "g" || u === "kg") return "mass";
  if (u === "ml" || u === "l") return "volume";
  if (u === "piece" || u === "dozen") return "count";
  if (u === "bunch") return "bunch";
  if (u === "packet") return "packet";
  return null;
}

/** The units a person may use to say how much, for a thing the shelf keeps in `shelf`. */
export function unitChoices(shelf: Unit | null | undefined): Unit[] {
  switch (familyOf(shelf)) {
    case "mass": return ["g", "kg"];
    case "volume": return ["ml", "l"];
    case "count": return ["piece", "dozen"];
    case "bunch": return ["g", "bunch"];
    case "packet": return ["packet"];
    default: return shelf ? [shelf] : [];
  }
}

/**
 * The unit this thing is naturally bought in. `typical` is its usual purchase,
 * in the shelf unit (a library "pack"); small usual purchases are weighed in grams.
 */
export function naturalUnit(shelf: Unit | null | undefined, typical?: number | null): Unit | null {
  switch (familyOf(shelf)) {
    case "mass": {
      const kg = shelf === "g" ? (typical ?? 1000) / 1000 : (typical ?? 1);
      return kg < 1 ? "g" : "kg";
    }
    case "volume": {
      const l = shelf === "ml" ? (typical ?? 1000) / 1000 : (typical ?? 1);
      return l < 1 ? "ml" : "l";
    }
    case "count": {
      const pieces = shelf === "dozen" ? (typical ?? 1) * 12 : (typical ?? 1);
      return pieces >= 12 && pieces % 12 === 0 ? "dozen" : "piece";
    }
    case "bunch": return "g";
    default: return shelf ?? null;
  }
}

/** Where a category starts, when nothing better is known (a new item typed in by hand). */
export function categoryUnit(category: string): Unit {
  if (category === "oil") return "l";
  if (category === "dairy") return "l";
  if (category === "spice" || category === "dry_fruit" || category === "other") return "g";
  return "kg";
}

const TO_BASE: Record<string, [string, number]> = {
  g: ["m", 1], kg: ["m", 1000], ml: ["v", 1], l: ["v", 1000], piece: ["c", 1], dozen: ["c", 12],
};

/** `qty` given in `from`, expressed in the shelf's own unit; null when they can't be compared. */
export function toShelf(qty: number, from: Unit | null, shelf: Unit | null): number | null {
  if (!from || !shelf || !Number.isFinite(qty)) return null;
  if (from === shelf) return qty;
  const grams = (u: Unit, q: number) => (u === "bunch" ? q * GRAMS_PER_BUNCH : u === "kg" ? q * 1000 : q);
  if (shelf === "bunch" && (from === "g" || from === "kg")) return round(grams(from, qty) / GRAMS_PER_BUNCH);
  if (from === "bunch" && (shelf === "g" || shelf === "kg")) return round(grams(from, qty) / (shelf === "kg" ? 1000 : 1));
  const f = TO_BASE[from], t = TO_BASE[shelf];
  if (f && t && f[0] === t[0]) return round((qty * f[1]) / t[1]);
  return null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A larger amount than any household buys in one go, in the shelf unit: probably the wrong unit. */
export function looksTooMuch(qtyInShelf: number, shelf: Unit | null): boolean {
  const base = shelf ? TO_BASE[shelf] : undefined;
  if (shelf === "bunch") return qtyInShelf > 30;
  if (shelf === "packet") return qtyInShelf > 50;
  if (!base) return false;
  const v = qtyInShelf * base[1];
  if (base[0] === "m" || base[0] === "v") return v > 50_000;   // over 50 kg or 50 litres
  return v > 120;                                              // over ten dozen
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** "250 g", "1.5 kg", "1 dozen", "6 pieces": whichever reads most naturally. */
export function friendly(q: number | null | undefined, u: Unit | null | undefined): string {
  if (q == null) return "";
  if (!u) return num(q);
  if (q === 0) return `0 ${u}`;
  if (u === "kg" || u === "g") {
    const g = u === "kg" ? q * 1000 : q;
    return g >= 1000 ? `${num(g / 1000)} kg` : `${num(g)} g`;
  }
  if (u === "l" || u === "ml") {
    const ml = u === "l" ? q * 1000 : q;
    return ml >= 1000 ? `${num(ml / 1000)} l` : `${num(ml)} ml`;
  }
  if (u === "dozen" || u === "piece") {
    const p = u === "dozen" ? q * 12 : q;
    if (p >= 12 && Number.isInteger(p / 12)) return `${num(p / 12)} dozen`;
    const n = Math.round(p * 10) / 10;
    return `${num(n)} ${n === 1 ? "piece" : "pieces"}`;
  }
  if (u === "bunch") return `${num(q)} ${q === 1 ? "bunch" : "bunches"}`;
  if (u === "packet") return `${num(q)} ${q === 1 ? "packet" : "packets"}`;
  return `${num(q)} ${u}`;
}
