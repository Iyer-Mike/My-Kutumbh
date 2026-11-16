"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { authErrorText } from "@/lib/auth-error";
import { emailReturnTo } from "@/lib/gate";
import { pendingInvite } from "@/lib/invite";
import KutumbhLogo from "@/components/KutumbhLogo";

/**
 * Proving the email address is theirs: the code from the email, typed here.
 * A code typed on the same screen works on any phone; a link opened from the
 * mail app often lands in a different browser and loses its way.
 */
export default function VerifyEmail({ email, next, loginHref }: { email: string; next: string | null; loginHref: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);          // seconds before another code may be asked for

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // The code's length is a server setting (6 today, it has been 8): take whatever the email shows
  const digits = code.replace(/\D/g, "").slice(0, 10);
  const ready = digits.length >= 6;

  async function verify() {
    if (!ready || busy) return;
    setBusy(true); setError(null); setNote(null);
    const supabase = createClient();
    let { error: e } = await supabase.auth.verifyOtp({ email, token: digits, type: "email" });
    // Older projects label the same code "signup"
    if (e) ({ error: e } = await supabase.auth.verifyOtp({ email, token: digits, type: "signup" }));
    if (e) {
      setBusy(false);
      setError(/expired|invalid/i.test(e.message ?? "")
        ? "That code was not accepted. Type every digit shown in the newest email. A code works for one hour and only the newest one counts. You can ask for a new code below."
        : authErrorText(e));
      return;
    }
    // In. An invitation opened on this phone comes first; otherwise where they were headed.
    const invite = pendingInvite();
    window.location.href = next ?? (invite ? `/join/${invite}` : "/waiting");
  }

  async function again() {
    if (wait > 0 || busy) return;
    setBusy(true); setError(null); setNote(null);
    const supabase = createClient();
    const { error: e } = await supabase.auth.resend({
      type: "signup", email,
      options: { emailRedirectTo: emailReturnTo(window.location.origin, next ?? "/onboarding") },
    });
    setBusy(false);
    if (e) { setError(authErrorText(e)); return; }
    setNote("A new code is on its way. The older one no longer works.");
    setWait(60);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-3xl px-6 pt-9 pb-7 mb-5 text-center"
        style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 60%, #4E3080 100%)" }}>
        <div className="flex justify-center mb-4"><KutumbhLogo size={48} color="#ffffff" /></div>
        <h2 className="text-2xl text-white m-0" style={{ fontFamily: "var(--font-dm-serif)" }}>Check your email</h2>
        <p className="text-sm mt-3 mb-0" style={{ color: "rgba(255,255,255,0.7)" }}>We sent a code to</p>
        <p className="text-sm font-semibold mt-1 mb-0 break-all" style={{ color: "#C9B8E4" }}>{email}</p>
      </div>

      <label htmlFor="verify-code" className="block text-sm font-semibold mb-2" style={{ color: "#241C33" }}>
        Type the code from the email, every digit
      </label>
      <input
        id="verify-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={digits}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
        placeholder="Code"
        className="w-full text-center rounded-xl py-3 text-2xl font-bold tabular-nums"
        style={{ ...fieldLook(FAMILY.amber), letterSpacing: "0.3em" }}
      />

      {error && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm mt-3" style={{ ...look(FAMILY.red), color: FAMILY.red.ink }}>{error}</div>
      )}
      {note && !error && (
        <div className="rounded-xl px-4 py-3 text-sm mt-3" style={{ ...look(FAMILY.green), color: FAMILY.green.ink }}>{note}</div>
      )}

      <button onClick={verify} disabled={!ready || busy}
        className="w-full mt-4 py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: "#241238" }}>
        {busy ? "One moment…" : "Confirm my email"}
      </button>

      <p className="text-xs mt-4 mb-0" style={{ color: "#6A6180", lineHeight: 1.6 }}>
        The email can take a minute. Look in Spam or Promotions too. The code works for one hour, and a new code replaces the old one. Tapping the link in the email works as well.
      </p>
      <p className="text-sm mt-3 mb-0" style={{ color: "#6A6180" }}>
        No email?{" "}
        <button onClick={again} disabled={wait > 0 || busy} className="font-semibold disabled:opacity-50" style={{ color: "#6B46B8" }}>
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </button>
      </p>
      <p className="text-sm mt-2 mb-0" style={{ color: "#6A6180" }}>
        Wrong address or already confirmed?{" "}
        <Link href={loginHref} className="font-semibold" style={{ color: "#6B46B8" }}>Go to Sign in</Link>
      </p>
    </div>
  );
}
