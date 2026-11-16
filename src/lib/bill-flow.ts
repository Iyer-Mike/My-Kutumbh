/**
 * From a checked bill to what gets recorded. One function, so the shelf and
 * the spending record are made from exactly the same approved lines.
 */
import { EATING_OUT, HOUSEHOLD } from "./spend.ts";

export type DraftLineIn = {
  name: string; quantity: string; unit: string; category: string; price: string; is_food: boolean;
};
export type ApprovedLine = {
  name: string; quantity: number | null; unit: string | null; category: string; price: number | null; is_food: boolean;
};

export function parseNumber(s: string): number | null {
  const n = parseFloat(s);
  return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Only lines with a name survive. Household and eating-out lines are spending only and never go to the shelf. */
export function approveLines(lines: DraftLineIn[]): ApprovedLine[] {
  return lines
    .filter((l) => l.name.trim())
    .map((l) => ({
      name: l.name.trim().slice(0, 60),
      quantity: parseNumber(l.quantity),
      unit: l.unit || null,
      category: l.is_food ? l.category : l.category === EATING_OUT ? EATING_OUT : HOUSEHOLD,
      price: parseNumber(l.price),
      is_food: l.is_food,
    }));
}

export const shelfLines = (approved: ApprovedLine[]) => approved.filter((l) => l.is_food);

/**
 * The amount bought on one bill line, worked out here and never by the reader.
 *
 * A bill often prints a pack size in the item's name and a number in the quantity
 * column: "BHINDI 225 G   1.07" means 1.07 times a 225 g pack, about 240 g. The
 * reader reports the two printed numbers; the multiplication and rounding are done here.
 */
const MEASURES = new Set(["g", "kg", "ml", "l"]);

export function lineAmount(o: {
  pack_size: number | null; pack_unit: string | null; count: number | null; unit: string | null;
}): { quantity: number | null; unit: string | null } {
  const pos = (n: number | null): n is number => n != null && Number.isFinite(n) && n > 0;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  // A printed pack size in a weight or volume: size x how many
  if (pos(o.pack_size) && o.pack_unit && MEASURES.has(o.pack_unit)) {
    const n = pos(o.count) ? o.count : 1;
    const raw = o.pack_size * n;
    if (Number.isInteger(n)) return { quantity: round3(raw), unit: o.pack_unit };
    // A part-pack is a weighed amount: round g and ml to the nearest 5 (kg and l to 0.005)
    const small = o.pack_unit === "g" || o.pack_unit === "ml";
    const q = small ? (raw >= 50 ? Math.round(raw / 5) * 5 : Math.round(raw)) : Math.round(raw * 200) / 200;
    return { quantity: q > 0 ? q : round3(raw), unit: o.pack_unit };
  }

  // No pack size: the quantity column is the amount, in whatever unit the line is sold by
  if (pos(o.count)) return { quantity: round3(o.count), unit: o.unit };
  return { quantity: null, unit: o.unit };
}
