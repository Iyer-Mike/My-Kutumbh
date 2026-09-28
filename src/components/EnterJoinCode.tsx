"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Where a newcomer types the number they were told.
 *
 * The link brought them here; the number lets them in. Six digits, the
 * shape of every OTP an Indian household has ever typed, so there is
 * nothing to explain.
 *
 * Every refusal says which kind it is, because "that didn't work" sends
 * a person back to the phone for no reason.
 */
export default function EnterJoinCode({ link, kutumbhHint }: { link?: string; kutumbhHint?: string | null }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const digits = code.replace(/\D/g, "").slice(0, 6);
  const ready = digits.length === 6;

  function submit() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/invite/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: digits, link }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "That didn't work. Please try again."); return; }
        router.push("/family");
        router.refresh();
      } catch {
        setError("No connection — try once more.");
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div>
        <label htmlFor="join-code" className="block text-sm font-semibold mb-2" style={{ color: "#241C33" }}>
          The six-digit number you were given
        </label>
        <input
          id="join-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={digits}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && ready) submit(); }}
          placeholder="000000"
          aria-describedby="join-code-help"
          className="w-full text-center rounded-2xl py-4 font-bold tabular-nums"
          style={{
            fontSize: "1.9rem", letterSpacing: "0.3em", color: "#241C33",
            background: "#fff", border: "1.5px solid #CBB4EE",
          }}
        />
        <p id="join-code-help" className="text-xs mt-2 m-0 text-center" style={{ color: "#6A6180" }}>
          {kutumbhHint
            ? `Ask ${kutumbhHint} for it if you don't have it.`
            : "The person who invited you will have said it on the phone or in a message."}
        </p>
      </div>

      {error && (
        <p className="text-sm text-center m-0 rounded-xl px-3 py-2.5"
          style={{ background: "#FBE2DC", color: "#9A2C1B" }}>
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!ready || pending}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "#241238" }}
      >
        {pending ? "One moment…" : "Join the Kutumbh"}
      </button>
    </div>
  );
}
