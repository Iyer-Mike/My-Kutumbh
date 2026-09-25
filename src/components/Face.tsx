import { BRAND as B } from "@/lib/brand";

/**
 * A person, shown as themselves where there is a photograph and as the
 * first letter of their name where there is not.
 */
export default function Face({
  url, name, size = 40, onDark = false,
}: {
  url?: string | null; name?: string | null; size?: number; onDark?: boolean;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  const box = { width: size, height: size, borderRadius: 999 } as const;

  if (url) {
    return (
      // A signed link from our own storage, good for an hour
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? "Family member"}
        className="object-cover flex-shrink-0"
        style={{ ...box, border: `1.5px solid ${onDark ? "rgba(255,255,255,0.35)" : B.cardEdge}` }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex items-center justify-center font-bold flex-shrink-0"
      style={{
        ...box,
        fontSize: Math.round(size * 0.4),
        background: onDark ? "rgba(255,255,255,0.15)" : B.tint,
        color: onDark ? "#fff" : B.violet,
      }}
    >
      {initial}
    </div>
  );
}
