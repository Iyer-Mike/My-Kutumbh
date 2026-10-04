"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The parts the four Insights pages are built from.
 *
 * Sizes are in rem, not pixels. A member who has set their phone to
 * large text is usually the member who most needs this app to be
 * legible; fixed pixels ignore that setting entirely. Nothing here is
 * smaller than 0.8rem, and the reading sizes sit near 1rem.
 */

export const C = {
  ink: "#241C33", ink2: "#4A4360", ink3: "#6A6180",
  card: "#FAF7FE", rule: "#E0D4F2", track: "#E7DCF7",
  leaf: "#2F6B34", warn: "#B0453A", gold: "#8A5A06",
  goldBg: "#FFFBF2", goldRule: "#EBD9B4",
  warnBg: "#FDF3F2", warnRule: "#E8C4BF",
  purple: "#6B46B8",
};

export const T = {
  label: "0.8125rem",   // the small capitals above a section
  note: "0.875rem",     // asides
  body: "0.95rem",      // explanations
  say: "1.05rem",       // an instruction, meant to be read first
  big: "1.9rem",        // one number that matters
};

export function Card({ children, tone = "plain", style }: {
  children: ReactNode;
  tone?: "plain" | "warn" | "gold" | "sky" | "mint";
  style?: CSSProperties;
}) {
  const skin =
    tone === "warn" ? { background: C.warnBg, border: `1px solid ${C.warnRule}` }
    : tone === "gold" ? { background: C.goldBg, border: `1px solid ${C.goldRule}` }
    : tone === "sky" ? { background: "#CFE4FA", border: "1px solid #7FB0E0", borderLeft: "7px solid #2E64A0" }
    : tone === "mint" ? { background: "#FFE2B8", border: "1px solid #E8A857", borderLeft: "7px solid #C2551F" }
    : { background: C.card, border: `1px solid ${C.rule}` };

  return <section className="rounded-2xl px-4 py-4" style={{ ...skin, ...style }}>{children}</section>;
}

export function Label({ n, children, tone = "plain", aside }: {
  n?: number;
  children: ReactNode;
  tone?: "plain" | "warn" | "gold";
  aside?: string;
}) {
  const colour = tone === "warn" ? C.warn : tone === "gold" ? C.gold : C.ink3;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="m-0 font-semibold uppercase tracking-widest" style={{ fontSize: T.label, color: colour }}>
        {n ? `${n} · ` : ""}{children}
      </p>
      {aside && <p className="m-0 flex-shrink-0" style={{ fontSize: T.label, color: C.ink3 }}>{aside}</p>}
    </div>
  );
}

/** A reading from a lab report, or any small fact with a number in it. */
export function Chip({ children, tone = "high" }: { children: ReactNode; tone?: "high" | "low" | "ok" | "quiet" }) {
  const skin =
    tone === "high" ? { background: "#FBE2DC", color: "#9A2C1B" }
    : tone === "low" ? { background: "#DDE9F6", color: "#1F4A78" }
    : tone === "ok"  ? { background: "#E1F0DE", color: "#1F5E25" }
    : { background: C.track, color: C.ink2 };

  return (
    <span className="px-2 py-0.5 rounded-full tabular-nums" style={{ fontSize: T.note, ...skin }}>
      {children}
    </span>
  );
}

/** How much of a target was met, or how far a limit was passed. */
export function Bar({ share, tone }: { share: number; tone: "bad" | "near" | "good" }) {
  const colour = tone === "bad" ? C.warn : tone === "near" ? C.gold : C.leaf;
  return (
    <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: C.track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(Math.min(share * 100, 100), 2)}%`, background: colour }} />
    </div>
  );
}

export function Row({ left, right, children }: { left: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: T.body, color: C.ink }}>{left}</span>
        {right && <span className="tabular-nums flex-shrink-0" style={{ fontSize: T.note, color: C.ink3 }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

export function Says({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-2" style={{ fontSize: T.body, color: C.ink2, lineHeight: 1.55 }}>{children}</p>;
}

export const num = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Small quantities keep a decimal; 0.6 of 2.2 is not "1 of 2". */
export const qty = (n: number) => (n >= 10 ? Math.round(n).toLocaleString("en-IN") : Math.round(n * 10) / 10);
