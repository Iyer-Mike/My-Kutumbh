"use client";

import { useState, useTransition } from "react";
import { handOverPrime, claimPrime, reclaimPrime } from "@/app/(app)/family/prime-actions";
import { QUIET_DAYS } from "@/lib/prime";

type Member = { user_id: string; full_name: string | null };

/**
 * The three ways the role moves, each shown only to the person who may
 * use it. Every rule here is enforced again in the database.
 */
export default function PrimeRole({
  isPrime,
  members,
  primeName,
  canClaim,
  canReclaim,
  quietDays,
}: {
  isPrime: boolean;
  members: Member[];
  primeName: string | null;
  canClaim: boolean;
  canReclaim: boolean;
  quietDays: number | null;
}) {
  const [choosing, setChoosing] = useState(false);
  const [confirm, setConfirm] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "It didn't work. Please try again.");
      else { setChoosing(false); setConfirm(null); }
    });

  // ── The one who was away, on returning ──
  if (canReclaim) {
    return (
      <section className="rounded-2xl px-4 py-4" style={{ background: "#FFFBF2", border: "1px solid #EBD9B4" }}>
        <p className="text-sm font-semibold m-0" style={{ color: "#241C33" }}>
          Welcome back
        </p>
        <p className="text-xs mt-1 mb-3" style={{ color: "#6A6180" }}>
          While you were away, someone else took on looking after the Kutumbh, so the family
          wasn&apos;t left waiting. You can take it back whenever you like.
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

  // ── A member, when the Prime Member has gone quiet ──
  if (canClaim) {
    return (
      <section className="rounded-2xl px-4 py-4" style={{ background: "#FFFBF2", border: "1px solid #EBD9B4" }}>
        <p className="text-sm font-semibold m-0" style={{ color: "#241C33" }}>
          Nobody is looking after the Kutumbh
        </p>
        <p className="text-xs mt-1 mb-3" style={{ color: "#6A6180" }}>
          {primeName ?? "The Prime Member"} hasn&apos;t opened the app for{" "}
          {quietDays === null ? `over ${QUIET_DAYS} days` : `${quietDays} days`}. You can take the role
          on so the family isn&apos;t stuck — and they can take it back for a fortnight after they return.
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

  // ── The Prime Member, handing on ──
  if (!isPrime || members.length < 2) return null;

  if (confirm) {
    return (
      <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
        <p className="text-sm m-0 mb-3" style={{ color: "#241C33" }}>
          Hand the Kutumbh to <span className="font-semibold">{confirm.full_name ?? "this member"}</span>?
          They will complete the family dishes, invite new members and keep the family photograph.
          You stay in the family as a member.
        </p>
        {error && <p className="text-xs mb-2" style={{ color: "#B0453A" }}>{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => run(() => handOverPrime(confirm.user_id))}
            disabled={pending}
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: "#2D1B4E", color: "#fff" }}
          >
            {pending ? "One moment…" : "Yes, hand it over"}
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="text-xs px-4 py-2 rounded-full"
            style={{ background: "#E7DCF7", color: "#6B46B8" }}
          >
            Not now
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
        Looking after the Kutumbh
      </p>

      {!choosing ? (
        <>
          <p className="text-xs mt-2 mb-3" style={{ color: "#6A6180" }}>
            You hold this role. If you are away for a week, any member can take it on so the family
            isn&apos;t left waiting — and you can take it back when you return.
          </p>
          <button
            onClick={() => setChoosing(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ background: "#E7DCF7", color: "#6B46B8" }}
          >
            Hand it to someone else
          </button>
        </>
      ) : (
        <>
          <p className="text-xs mt-2 mb-2" style={{ color: "#6A6180" }}>Who should look after it?</p>
          <div className="space-y-2">
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => setConfirm(m)}
                className="w-full text-left text-sm px-3 py-2 rounded-xl"
                style={{ background: "#fff", border: "1px solid #E0D4F2", color: "#241C33" }}
              >
                {m.full_name ?? "Family member"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setChoosing(false)}
            className="text-xs mt-3 font-medium"
            style={{ color: "#6B46B8" }}
          >
            Never mind
          </button>
        </>
      )}
    </section>
  );
}
