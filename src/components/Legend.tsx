/**
 * A small key to colours: one solid dot and its meaning per entry. Shown wherever colour carries meaning.
 * Dots, not outlined squares: squares were mistaken for boxes to tick.
 */
export type LegendEntry = { colour: string; edge?: string; label: string };

export default function Legend({ title = "Colours", entries }: { title?: string; entries: LegendEntry[] }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "#6A6180" }} aria-label={`${title} key`}>
      <span className="font-bold uppercase tracking-wide">{title} · colour key:</span>
      {entries.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block rounded-full" style={{ width: 10, height: 10, background: e.edge ?? e.colour }} />
          {e.label}
        </span>
      ))}
    </p>
  );
}
