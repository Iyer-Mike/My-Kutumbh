import Link from "next/link";
import { FAMILY, look } from "@/lib/brand";

/** Pantry and Recipes used to be two taps down, under Kutumbh. */
export default function HomeShortcuts() {
  const cell = "flex-1 flex items-center justify-center gap-2 rounded-2xl px-3 py-3 min-h-12 text-sm font-semibold";
  return (
    <nav className="mt-3 flex gap-3" aria-label="Kitchen shortcuts">
      <Link href="/pantry" className={cell} style={{ ...look(FAMILY.green), color: "#241C33" }}>
        <span aria-hidden>🧺</span> Pantry
      </Link>
      <Link href="/recipes" className={cell} style={{ ...look(FAMILY.amber), color: "#241C33" }}>
        <span aria-hidden>🍲</span> Recipes
      </Link>
    </nav>
  );
}
