"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND as B, FAMILY, look } from "@/lib/brand";

export type ShortLine = { name: string; note: string };

const SEEN_KEY = "mk-short-seen-items";

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
function writeSeen(names: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(names)); } catch { /* fine */ }
}

/**
 * Home: a line saying how much is on the shopping list, and a pop-up naming
 * what has run short. The pop-up appears only for items not told about before:
 * once it has been attended to (See list / Later) it stays quiet until a NEW
 * item runs short, or one that was restocked runs short again.
 */
export default function RunningShort({ toBuy, short }: { toBuy: number; short: ShortLine[]; today?: string }) {
  const [fresh, setFresh] = useState<ShortLine[]>([]);
  const key = short.map((s) => s.name).sort().join("|");

  useEffect(() => {
    const names = key ? key.split("|") : [];
    const seen = readSeen();
    // Items that are no longer short are forgotten, so they count as new if they run short again
    const kept = seen.filter((n) => names.includes(n));
    if (kept.length !== seen.length) writeSeen(kept);
    setFresh(short.filter((s) => !kept.includes(s.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const later = () => {
    writeSeen(Array.from(new Set([...readSeen(), ...short.map((s) => s.name)])));
    setFresh([]);
  };
  const show = fresh.length > 0;

  return (
    <>
      {toBuy > 0 && (
        <Link href="/pantry?step=shop" className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 min-h-11"
          style={look(FAMILY.green)}>
          <span className="text-sm font-semibold" style={{ color: B.ink }}>🛒 To buy · {toBuy}</span>
          <span className="text-xs" style={{ color: B.muted }}>
            {short.length ? `${short.length} running short` : "Shopping list"} →
          </span>
        </Link>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3"
          style={{ background: "rgba(20,10,40,0.55)" }} role="dialog" aria-modal="true" aria-label="Running short">
          <div className="w-full max-w-md rounded-2xl px-4 py-4 grid gap-3 max-h-[80vh] overflow-y-auto" style={{ background: "#FFFFFF" }}>
            <div>
              <p className="text-base font-bold m-0" style={{ color: B.ink }}>🛒 Running short ({fresh.length})</p>
              <p className="text-xs m-0 mt-1" style={{ color: B.muted }}>
                Worked out from the menu cooked and the bills. Already on the shopping list.
              </p>
            </div>
            <ul className="m-0 p-0 list-none grid">
              {fresh.slice(0, 12).map((s) => (
                <li key={s.name} className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderTop: `1px solid ${B.cardEdge}` }}>
                  <span style={{ color: B.ink }}>{s.name}</span>
                  <span className="text-xs shrink-0" style={{ color: "#9A2C1B" }}>{s.note}</span>
                </li>
              ))}
              {fresh.length > 12 && (
                <li className="text-xs pt-1.5" style={{ color: B.muted }}>and {fresh.length - 12} more</li>
              )}
            </ul>
            <div className="flex gap-2">
              <Link href="/pantry?step=shop" onClick={later}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white text-center" style={{ background: B.button }}>
                See shopping list
              </Link>
              <button onClick={later} className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: B.tint, color: B.violet }}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
