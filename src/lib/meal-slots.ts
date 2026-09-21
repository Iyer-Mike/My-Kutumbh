export type Slot = "breakfast" | "morning_snack" | "lunch" | "evening_snack" | "dinner";

export const SLOTS: { key: Slot; label: string; icon: string; time: string }[] = [
  { key: "breakfast",     label: "Breakfast",     icon: "☀️", time: "7 – 9 am"   },
  { key: "morning_snack", label: "Morning Snack", icon: "🍎", time: "10 – 11 am" },
  { key: "lunch",         label: "Lunch",         icon: "🌤️", time: "12 – 2 pm"  },
  { key: "evening_snack", label: "Evening Snack", icon: "☕", time: "4 – 6 pm"   },
  { key: "dinner",        label: "Dinner",        icon: "🌙", time: "7 – 9 pm"   },
];

export const SLOT_KEYS = SLOTS.map((s) => s.key);

export function isSlot(v: string | null | undefined): v is Slot {
  return !!v && (SLOT_KEYS as string[]).includes(v);
}

export function slotLabel(slot: string): string {
  return SLOTS.find((s) => s.key === slot)?.label ?? slot;
}

export function defaultPoolName(slot: string): string {
  return `Family ${slotLabel(slot)}`;
}
