"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forgetMe } from "@/app/(app)/profile/forget-actions";

/**
 * What the app holds about you, and how to take it away.
 * Being forgotten is a separate, heavier door — it is not offered here
 * until the export is at least available, so nobody deletes what they
 * have not been able to keep.
 */
export default function MyDataCard() {
  const [taken, setTaken] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Typing the word is not a formality: it is the moment someone
  // realises they meant the other button.
  const ready = typed.trim().toLowerCase() === "forget me";

  return (
    <section className="rounded-2xl px-4 py-4" style={{ background: "#FAF7FE", border: "1px solid #E0D4F2" }}>
      <p className="text-xs font-semibold uppercase tracking-widest m-0" style={{ color: "#6A6180" }}>
        Your data
      </p>
      <p className="text-xs mt-2 mb-3" style={{ color: "#6A6180" }}>
        Everything the app holds about you — your profile, every meal logged, your medical
        records, what the AI has cost you — in one plain file you can keep or read anywhere.
      </p>

      <a
        href="/api/my-data"
        onClick={() => setTaken(true)}
        className="inline-block text-xs font-semibold px-4 py-2 rounded-full"
        style={{ background: "#E7DCF7", color: "#6B46B8" }}
      >
        Take my data
      </a>

      {taken && (
        <p className="text-[11px] mt-2 mb-0" style={{ color: "#4A7C4A" }}>
          Saved to your downloads. It is yours — nothing here changes.
        </p>
      )}

      {/* ── Leaving for good ── */}
      <div className="mt-5 pt-4" style={{ borderTop: "1px solid #E0D4F2" }}>
        {!leaving ? (
          <button
            onClick={() => setLeaving(true)}
            className="text-xs font-medium"
            style={{ color: "#B0453A" }}
          >
            Forget me and delete my account
          </button>
        ) : (
          <div>
            <p className="text-xs m-0 mb-2" style={{ color: "#241C33" }}>
              This removes your profile, every meal you have logged, your medical records and your
              photographs. It cannot be undone, and nobody — not even the person who runs the app —
              can bring it back.
            </p>
            <p className="text-xs m-0 mb-3" style={{ color: "#6A6180" }}>
              What belongs to your family stays: the dishes, the pantry, the shopping list. Your name
              simply comes off them. Take your data first if you want to keep it.
            </p>

            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type: forget me"
              className="w-full text-sm rounded-lg px-3 py-2 mb-2"
              style={{ background: "#fff", border: "1px solid #E8C4BF", color: "#241C33" }}
            />

            {error && <p className="text-xs mb-2" style={{ color: "#B0453A" }}>{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await forgetMe();
                    if (r.ok) router.push("/login?forgotten=1");
                    else setError(r.error ?? "It didn't work.");
                  })
                }
                disabled={!ready || pending}
                className="text-xs font-semibold px-4 py-2 rounded-full"
                style={{ background: ready ? "#B0453A" : "#E8C4BF", color: "#fff" }}
              >
                {pending ? "Removing everything…" : "Delete my account"}
              </button>
              <button
                onClick={() => { setLeaving(false); setTyped(""); setError(null); }}
                className="text-xs px-4 py-2 rounded-full"
                style={{ background: "#E7DCF7", color: "#6B46B8" }}
              >
                Keep my account
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
