"use client";

import { useState, useTransition } from "react";
import { withdrawNotice } from "@/app/(app)/admin/actions";

/** Takes a letter back. Asks once, because it cannot be undone. */
export default function WithdrawLetter({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (error) return <span className="text-[11px]" style={{ color: "#B0453A" }}>{error}</span>;

  if (!sure) {
    return (
      <button onClick={() => setSure(true)} className="text-[11px] font-medium" style={{ color: "#8A80A0" }}>
        Withdraw
      </button>
    );
  }

  return (
    <span className="text-[11px]" style={{ color: "#6A6180" }}>
      Take it back?{" "}
      <button
        onClick={() => start(async () => {
          const r = await withdrawNotice(id);
          if (!r.ok) setError(r.error ?? "It didn't work.");
        })}
        disabled={pending}
        className="font-semibold"
        style={{ color: "#B0453A" }}
      >
        {pending ? "Withdrawing…" : "Yes"}
      </button>
      {" · "}
      <button onClick={() => setSure(false)} className="font-medium" style={{ color: "#6B46B8" }}>
        No
      </button>
    </span>
  );
}
