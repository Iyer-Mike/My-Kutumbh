"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { inviteFromPath, rememberInvite } from "@/lib/invite";
import { emailReturnTo } from "@/lib/gate";
import { authErrorText } from "@/lib/auth-error";
import KutumbhLogo from "@/components/KutumbhLogo";
import PasswordRules, { passwordOk } from "@/components/PasswordRules";

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? null;

  const [email, setEmail] = useState("");
  // Someone arriving on a family's invitation does not need a passcode
  // from the Admin: their Key Member is vouching for them, and the
  // six-digit number on the next page does the same work.
  const invitedToFamily = !!inviteFromPath(redirectTo);
  const [pwTouched, setPwTouched] = useState(false);
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
    if (!passwordOk(password)) {
      setError("Use at least 8 characters, with both letters and digits.");
      return;
    }
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
      setError(authErrorText(error));
      setLoading(false);
      return;
    }

    if (data.session) {
      if (invitedToFamily) {
        // Straight to the family's own door, where the number admits them
        window.location.href = redirectTo!;
        return;
      }

      // Anyone may register. The Admin decides who is let in: ask for a
      // place in the waiting room now (the waiting page asks again, so a
      // failure here costs nothing).
      await supabase.rpc("request_admission");

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
          <p className="m-0 text-xs rounded-xl px-3 py-2.5" style={{ background: "#F3EEFA", border: "2px solid #CBB4EE", color: "#4A4360", lineHeight: 1.55 }}>
            Anyone can register. After you do, a person at My Kutumb Bhojan welcomes you in — usually within a day.
          </p>
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
            onBlur={() => setPwTouched(true)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={fieldLook(FAMILY.amber)}
            placeholder="8+ characters, letters and digits"
          />
          <PasswordRules password={password} touched={pwTouched} />
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
        <Link href="/terms" style={{ color: "#6B46B8" }}>Using My Kutumb Bhojan</Link>
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
