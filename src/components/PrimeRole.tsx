"use client";

import { FAMILY, look } from "@/lib/brand";
import { useState, useTransition } from "react";
import { claimPrime, reclaimPrime } from "@/app/(app)/family/prime-actions";
import { QUIET_DAYS } from "@/lib/prime";

/**
 * The three ways the role moves, each shown only to the person who may
 * use it. Every rule here is enforced again in the database.
 */
export default function PrimeRole({
  primeName,
  canClaim,
  canReclaim,
  quietDays,
}: {
  primeName: string | null;
  canClaim: boolean;
  canReclaim: boolean;
  quietDays: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "It didn't work. Please try again.");
      
    });

  // ── The one who was away, on returning ──
  if (canReclaim) {
    return (
      <section className="rounded-2xl px-4 py-4" style={look(FAMILY.gold)}>
        <p className="text-sm font-semibold m-0" style={{ color: "#241C33" }}>
          Welcome back
        </p>
        <p className="text-xs mt-1 mb-3" style={{ color: "#6A6180" }}>
          Someone took over while you were away. You can take it back anytime.
        </p>
        {error && <p className="text-xs mb-2" style={{ color: "#B0453A" }}>{error}</p>}
        <button
          onClick={() => run(reclaimPrime)}
          disabled={pending}
          className="text-xs font-semibold px-4 py-2 rounded-full"
          style={{ background: "#2D1B4E", color: "#fff" }}
        >
          {pending ? "One moment…" : "Take it back"}
        </button>
      </section>
    );
  }

  // ── A member, when the Key Member has gone quiet ──
  if (canClaim) {
    return (
      <section className="rounded-2xl px-4 py-4" style={look(FAMILY.gold)}>
        <p className="text-sm font-semibold m-0" style={{ color: "#241C33" }}>
          Nobody is looking after the Kutumbh
        </p>
        <p className="text-xs mt-1 mb-3" style={{ color: "#6A6180" }}>
          {primeName ?? "The Key Member"} inactive for{" "}
          {quietDays === null ? `over ${QUIET_DAYS} days` : `${quietDays} days`}. You can take over; they can reclaim it for 14 days after returning.
        </p>
        {error && <p className="text-xs mb-2" style={{ color: "#B0453A" }}>{error}</p>}
        <button
          onClick={() => run(claimPrime)}
          disabled={pending}
          className="text-xs font-semibold px-4 py-2 rounded-full"
          style={{ background: "#2D1B4E", color: "#fff" }}
        >
          {pending ? "One moment…" : "Look after the Kutumbh"}
        </button>
      </section>
    );
  }

  // The hand-over itself now lives in the Family list, under "Who will manage the Kutumbh?"
  return null;
}
