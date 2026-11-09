import Link from "next/link";
import { BRAND as B } from "@/lib/brand";
import type { Attention } from "@/lib/family-alerts";

/** "Needs you": the reasons behind the red "!" on the Kutumbh tab, one line each, one tap to deal with it. */
export default function AttentionCard({ items }: { items: Attention[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl px-4 py-3 grid gap-1" style={{ background: "#FFF1F0", border: "1.5px solid #E5484D" }} aria-label="Needs your attention">
      <p className="text-xs font-bold m-0 uppercase tracking-wide" style={{ color: "#B42318" }}>Needs you · {items.length}</p>
      {items.map((it, i) => (
        <div key={it.key} className="flex items-center justify-between gap-3 py-1.5" style={i ? { borderTop: "1px solid #F5C6C2" } : undefined}>
          <span className="text-sm" style={{ color: B.ink }}>{i + 1}. {it.text}</span>
          <Link href={it.href} className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 text-white" style={{ background: "#B42318" }}>{it.cta}</Link>
        </div>
      ))}
      <p className="text-[11px] m-0 mt-1" style={{ color: B.muted }}>Each line goes away once dealt with, and then the "!" goes too.</p>
    </section>
  );
}
