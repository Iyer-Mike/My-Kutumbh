/** A small key to colours: one swatch and its meaning per entry. Shown wherever colour carries meaning. */
export type LegendEntry = { colour: string; edge?: string; label: string };

export default function Legend({ title = "Colours", entries }: { title?: string; entries: LegendEntry[] }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "#6A6180" }} aria-label={`${title} key`}>
      <span className="font-bold uppercase tracking-wide">{title}</span>
      {entries.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block rounded-sm" style={{ width: 12, height: 12, background: e.colour, border: `1.5px solid ${e.edge ?? e.colour}` }} />
          {e.label}
        </span>
      ))}
    </p>
  );
}
