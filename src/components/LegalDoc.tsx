import type { Doc } from "@/lib/legal";

/**
 * A document, set to be read rather than scrolled past.
 *
 * Generous line height, one column, nothing collapsed behind a
 * "show more". If a family member has to open something to find out
 * who reads their blood report, the page is working against them.
 *
 * Type sizes are in rem so that a phone set to large text enlarges
 * these too — the same choice the Insights pages make, and it matters
 * more here than anywhere else in the app.
 */

const C = { ink: "#241C33", ink2: "#3D3550", muted: "#6A6180", rule: "#E0D4F2" };

/** `**bold**` and `*italic*`, and nothing else. */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={`${key}-${i}`} style={{ color: C.ink, fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <em key={`${key}-${i}`}>{p.slice(1, -1)}</em>;
    }
    return <span key={`${key}-${i}`}>{p}</span>;
  });
}

export default function LegalDoc({ doc, compact = false }: { doc: Doc; compact?: boolean }) {
  return (
    <article>
      <h1
        className="m-0"
        style={{
          fontFamily: "var(--font-dm-serif)",
          color: C.ink,
          fontSize: compact ? "1.35rem" : "1.6rem",
          lineHeight: 1.25,
        }}
      >
        {doc.title}
      </h1>

      {doc.lede && (
        <p
          className="mt-3 mb-0"
          style={{ color: C.ink2, fontSize: "1rem", lineHeight: 1.65, fontStyle: "italic" }}
        >
          {doc.lede}
        </p>
      )}

      {doc.sections.map((s, si) => (
        <section key={si} className="mt-6">
          {s.heading && (
            <h2
              className="m-0 mb-2"
              style={{ color: C.ink, fontSize: "0.95rem", fontWeight: 600, letterSpacing: "0.01em" }}
            >
              {s.heading}
            </h2>
          )}
          {s.body.map((p, pi) => (
            <p
              key={pi}
              className="m-0"
              style={{ color: C.ink2, fontSize: "0.95rem", lineHeight: 1.7, marginTop: pi ? "0.6rem" : 0 }}
            >
              {inline(p, `${si}-${pi}`)}
            </p>
          ))}
        </section>
      ))}

      <p
        className="mt-7 mb-0 pt-4"
        style={{ borderTop: `1px solid ${C.rule}`, color: C.muted, fontSize: "0.8125rem" }}
      >
        This version: {doc.version}
      </p>
    </article>
  );
}
