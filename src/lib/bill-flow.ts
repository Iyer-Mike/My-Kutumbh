/**
 * From a checked bill to what gets recorded. One function, so the shelf and
 * the spending record are made from exactly the same approved lines.
 */
import { HOUSEHOLD } from "./spend.ts";

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

/** Only lines with a name survive; household lines are filed as household and never go to the shelf. */
export function approveLines(lines: DraftLineIn[]): ApprovedLine[] {
  return lines
    .filter((l) => l.name.trim())
    .map((l) => ({
      name: l.name.trim().slice(0, 60),
      quantity: parseNumber(l.quantity),
      unit: l.unit || null,
      category: l.is_food ? l.category : HOUSEHOLD,
      price: parseNumber(l.price),
      is_food: l.is_food,
    }));
}

export const shelfLines = (approved: ApprovedLine[]) => approved.filter((l) => l.is_food);
