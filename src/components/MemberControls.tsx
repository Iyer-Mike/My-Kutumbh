"use client";

import { FAMILY, look } from "@/lib/brand";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember, leaveKutumbh } from "@/app/(app)/family/member-actions";

const C = { ink: "#241C33", ink2: "#4A4360", ink3: "#6A6180", warn: "#B0453A", purple: "#6B46B8" };

/**
 * Removing a member, and leaving a Kutumbh.
 *
 * Both ask once. Neither is dressed up as dangerous — a family taking
 * somebody out, or somebody stepping away, is an ordinary thing that
 * happens in households. What is lost is stated plainly, because most
 * of the worry is not knowing.
 */
export function RemoveMember({ userId, name }: { userId: string; name: string | null }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (error) {
    return <p className="text-xs m-0 mt-2" style={{ color: C.warn }}>{error}</p>;
  }

  if (!sure) {
    return (
      <button
        onClick={() => setSure(true)}
        className="text-[11px] font-medium mt-2"
        style={{ color: C.ink3 }}
      >
        Remove from the Kutumbh
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5" style={look(FAMILY.red)}>
      <p className="text-xs m-0" style={{ color: C.ink, lineHeight: 1.5 }}>
        Remove <span className="font-semibold">{name ?? "this member"}</span> from the Kutumbh? Their own meals,
        reports and account stay theirs and go with them. What they added to the family — dishes, the pantry,
        the shopping list — stays here.
      </p>
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => start(async () => {
            const r = await removeMember(userId);
            if (!r.ok) setError(r.error ?? "It didn't work.");
          })}
          disabled={pending}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: C.warn, color: "#fff" }}
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button
          onClick={() => setSure(false)}
          className="text-xs px-3 py-1.5 rounded-full"
          style={{ background: "#E7DCF7", color: C.purple }}
        >
          Keep them
        </button>
      </div>
    </div>
  );
}

export function LeaveKutumbh({ kutumbhName, isPrime }: { kutumbhName: string | null; isPrime: boolean }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!sure) {
    return (
      <button onClick={() => setSure(true)} className="text-xs font-medium" style={{ color: C.ink3 }}>
        Leave this Kutumbh
      </button>
    );
  }

  return (
    <div className="rounded-xl px-3 py-3" style={look(FAMILY.red)}>
      <p className="text-xs m-0" style={{ color: C.ink, lineHeight: 1.5 }}>
        Leave {kutumbhName ?? "this Kutumbh"}? Everything of yours stays yours — your meals, your reports, your
        account. You would no longer see the family&apos;s menu, dishes or pantry.
        {isPrime && " As the Key Member, hand the role to someone else first."}
      </p>
      {error && <p className="text-xs mt-2 mb-0" style={{ color: C.warn }}>{error}</p>}
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => start(async () => {
            setError(null);
            const r = await leaveKutumbh();
            if (r.ok) router.push("/dashboard");
            else setError(r.error ?? "It didn't work.");
          })}
          disabled={pending}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: C.warn, color: "#fff" }}
        >
          {pending ? "Leaving…" : "Yes, leave"}
        </button>
        <button
          onClick={() => { setSure(false); setError(null); }}
          className="text-xs px-3 py-1.5 rounded-full"
          style={{ background: "#E7DCF7", color: C.purple }}
        >
          Stay
        </button>
      </div>
    </div>
  );
}
