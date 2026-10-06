"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { offerCode } from "@/app/waiting/actions";
import { FAMILY, look, fieldLook } from "@/lib/brand";

/**
 * One box for whichever code a person happens to be holding.
 *
 * There are two: a passcode from the Admin's letter, and a six-digit
 * number from a Key Member. A newcomer has no idea these are
 * different things, and should not have to. The box tries both.
 */
export default function EnterAnyCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const value = code.trim();

  return (
    <div className="mt-5 pt-5" style={{ borderTop: "1px solid #E0D4F2" }}>
      <label htmlFor="any-code" className="block text-sm font-semibold mb-2" style={{ color: "#241C33" }}>
        Have a code?
      </label>
      <p className="m-0 mb-2 text-xs" style={{ color: "#6A6180", lineHeight: 1.5 }}>
        A passcode from the letter that invited you, or the six-digit number a family gave you.
      </p>

      <input
        id="any-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter" && value) submit(); }}
        placeholder="paste or type it here"
        className="w-full text-center rounded-xl py-3 font-semibold tracking-widest"
        style={fieldLook(FAMILY.amber)}
      />

      {error && (
        <p className="text-xs mt-2 mb-0 text-center rounded-lg px-3 py-2"
          style={{ ...look(FAMILY.red), color: FAMILY.red.ink }}>
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!value || pending}
        className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "#241238" }}
      >
        {pending ? "One moment…" : "Use this code"}
      </button>
    </div>
  );

  function submit() {
    setError(null);
    start(async () => {
      const r = await offerCode(value);
      if (r.ok) { router.push(r.went === "family" ? "/family" : "/waiting"); router.refresh(); }
      else setError(r.error ?? "That code wasn't recognised.");
    });
  }
}
