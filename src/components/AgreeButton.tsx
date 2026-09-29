"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agreeToEverything } from "@/app/agree/actions";

/**
 * One button, at the bottom, after the words.
 *
 * Deliberately not a pre-ticked box, and deliberately not at the top:
 * agreeing is the last thing on the page because reading is meant to
 * come first. There is no "decline and continue anyway" — declining is
 * simply not tapping it, and the page says what that means.
 */
export default function AgreeButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      {error && (
        <p
          className="text-sm mb-3 mt-0 rounded-xl px-4 py-3"
          style={{ background: "#FBE2DC", color: "#9A2C1B" }}
        >
          {error}
        </p>
      )}

      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await agreeToEverything();
            if (r.ok) { router.replace("/dashboard"); router.refresh(); }
            else setError(r.error ?? "That didn't go through.");
          })
        }
        disabled={pending}
        className="w-full py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
        style={{ background: "#241238" }}
      >
        {pending ? "One moment…" : "I have read both, and I agree"}
      </button>

      <p className="text-xs text-center mt-3 mb-0" style={{ color: "#6A6180", lineHeight: 1.6 }}>
        If you would rather not agree, close the app and nothing more happens.
        Nothing is kept about you that you have not already entered, and you can
        ask for it back or ask to be forgotten at any time.
      </p>
    </div>
  );
}
