// Regular supply: milk, curd, eggs and the like that come to the door on a rhythm.
import type { Unit } from "./pantry.ts";
import { friendly } from "./units.ts";

export const SUPPLY_EVERY: { days: number; label: string }[] = [
  { days: 1, label: "every day" },
  { days: 2, label: "every 2 days" },
  { days: 3, label: "every 3 days" },
  { days: 7, label: "every week" },
  { days: 14, label: "every 2 weeks" },
  { days: 30, label: "every month" },
];

export function everyLabel(days: number): string {
  return SUPPLY_EVERY.find((e) => e.days === days)?.label ?? `every ${days} days`;
}

/** "1 l every day", or just "every day" when no amount was given. */
export function supplyText(qty: number | null | undefined, unit: Unit | null | undefined, days: number): string {
  const how = everyLabel(days);
  return qty != null && qty > 0 ? `${friendly(qty, unit ?? null)} ${how}` : how;
}

/** Things that are usually delivered, to suggest the setting when an item is opened. */
export const USUALLY_SUPPLIED = /\b(milk|curd|yogurt|yoghurt|buttermilk|eggs?|paneer|bread|water)\b/i;
