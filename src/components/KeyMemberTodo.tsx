import Link from "next/link";
import { FAMILY, look } from "@/lib/brand";

export type TodoLine = { text: string; href: string };

/**
 * Everything waiting for the Key Member, in one place on Home.
 * Shown only when there is something to do; the lines are the same
 * things that already show up elsewhere, gathered so none is missed.
 */
export default function KeyMemberTodo({ lines }: { lines: TodoLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="rounded-2xl px-4 py-3 mb-4" style={look(FAMILY.gold)} aria-label="Waiting for you">
      <p className="m-0 mb-1.5 text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: FAMILY.gold.ink }}>
        ★ Waiting for you
      </p>
      <ul className="m-0 p-0 list-none grid gap-1">
        {lines.map((l) => (
          <li key={l.text}>
            <Link href={l.href} className="flex items-center justify-between gap-3 py-1.5 min-h-11 text-sm font-semibold" style={{ color: "#241C33" }}>
              <span>{l.text}</span>
              <span aria-hidden style={{ color: "#6B46B8" }}>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
