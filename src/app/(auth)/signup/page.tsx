"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { inviteFromPath, rememberInvite } from "@/lib/invite";
import { emailReturnTo } from "@/lib/gate";
import KutumbhLogo from "@/components/KutumbhLogo";

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? null;

  const [email, setEmail] = useState("");
  // The passcode from the letter. Registration needs it; joining a
  // family later uses a different number entirely.
  const [passcode, setPasscode] = useState("");
  // Someone arriving on a family's invitation does not need a passcode
  // from the Admin: their Key Member is vouching for them, and the
  // six-digit number on the next page does the same work.
  const invitedToFamily = !!inviteFromPath(redirectTo);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/login";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const next = redirectTo ?? "/onboarding";
    const code = inviteFromPath(redirectTo);
    if (code) rememberInvite(code);            // survive the trip through email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: emailReturnTo(window.location.origin, next),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      if (invitedToFamily) {
        // Straight to the family's own door, where the number admits them
        window.location.href = redirectTo!;
        return;
      }

      // Knock at the app's own door with the passcode from the letter.
      // Somebody at My Kutumbh decides; until then they wait.
      const { error: claimError } = await supabase.rpc("claim_app_invite", { p_code: passcode.trim() });

      if (claimError) {
        setError(
          /wrong_passcode/.test(claimError.message)
            ? "That passcode doesn't match. Check the letter you were sent."
            : /passcode_expired/.test(claimError.message)
            ? "That passcode has expired — they last a day. Ask for a fresh one."
            : "Your account was made, but the passcode wasn't accepted. Sign in and try again.",
        );
        setLoading(false);
        return;
      }

      window.location.href = "/waiting";
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="rounded-3xl px-6 pt-10 pb-8 mb-6"
          style={{ background: "linear-gradient(160deg, #241238 0%, #3A2260 60%, #4E3080 100%)" }}
        >
          <div className="flex justify-center mb-4">
            <KutumbhLogo size={52} color="#ffffff" />
          </div>
          <h2 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
            Check your inbox
          </h2>
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.65)" }}>
            We sent a confirmation link to
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: "#C9B8E4" }}>{email}</p>
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
            Click the link, then come back here to sign in.
          </p>
        </div>
        <Link
          href={loginHref}
          className="block w-full py-3.5 rounded-xl font-semibold text-sm text-white text-center"
          style={{ background: "#241238" }}
        >
          Go to Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <AuthHeader subtitle="Create your family account" />

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
            Your name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={fieldLook(FAMILY.amber)}
            placeholder="Mohan Iyer"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={fieldLook(FAMILY.amber)}
            placeholder="you@email.com"
          />
        </div>

        {!invitedToFamily && (
        <div>
          <label htmlFor="passcode" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>

            Passcode from your invitation

          </label>

          <input

            id="passcode"

            type="text"

            autoComplete="off"

            required

            value={passcode}

            onChange={(e) => setPasscode(e.target.value.toUpperCase())}

            placeholder="the code in your letter"

            className="w-full px-4 py-3 rounded-xl text-sm tracking-widest focus:outline-none"
            style={fieldLook(FAMILY.amber)}
          />
          <p className="text-xs mt-1.5" style={{ color: "#8A80A0" }}>
            The code in the invitation you were sent. It lasts a day.
          </p>
        </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={fieldLook(FAMILY.amber)}
            placeholder="Min. 8 characters"
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ ...look(FAMILY.red), color: FAMILY.red.ink }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: "#241238" }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: "#6A6180" }}>
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold" style={{ color: "#6B46B8" }}>
          Sign in
        </Link>
      </p>

      {/* What you would be handing over, before you hand it over */}
      <p className="text-center text-xs mt-4 mb-0" style={{ color: "#6A6180" }}>
        <Link href="/privacy" style={{ color: "#6B46B8" }}>What the app knows about you</Link>
        <span className="mx-1.5">·</span>
        <Link href="/terms" style={{ color: "#6B46B8" }}>Using My Kutumbh</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
