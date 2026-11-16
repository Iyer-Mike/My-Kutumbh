"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { FAMILY, look, fieldLook } from "@/lib/brand";
import { inviteFromPath, pendingInvite, rememberInvite } from "@/lib/invite";
import { emailReturnTo } from "@/lib/gate";
import { authErrorText, checkEmail } from "@/lib/auth-error";
import PasswordRules, { passwordOk } from "@/components/PasswordRules";
import VerifyEmail from "@/components/VerifyEmail";

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? null;

  // The invitation page passes on the address the family invited
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
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
    // Our own checks, in our own words: the browser's pop-up messages are vague and vary by phone
    if (!name.trim()) { setError("Please type your name."); return; }
    const checked = checkEmail(email);
    if (checked.problem) { setError(checked.problem); return; }
    if (!password) { setError("Please choose a password."); return; }
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
    setEmail(checked.email);
    const { data, error } = await supabase.auth.signUp({
      email: checked.email,
      password,
      options: {
        data: { full_name: name.trim() },
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
      // An invitation opened earlier on this phone, before they found their way here
      const remembered = pendingInvite();
      if (remembered) { window.location.href = `/join/${remembered}`; return; }

      // Anyone may register. The waiting page sorts out where they belong:
      // to a family that invited this address, or to the Admin's waiting room.
      window.location.href = "/waiting";
      return;
    }

    // With confirmation on, an address that already has an account comes back
    // looking like a new one, but no email is sent: say so rather than leave them waiting.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      setError("This email already has an account. Tap Sign in below, or use Forgot password if you don't remember it.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) return <VerifyEmail email={email} next={redirectTo} loginHref={loginHref} />;

  return (
    <div className="w-full max-w-sm">
      <AuthHeader subtitle="Create your family account" />

      <form onSubmit={handleSignup} noValidate className="space-y-4">
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
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
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
            Three steps: register here, confirm your email with the code we send, then name your family. You can start straight away.
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
          <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ ...look(FAMILY.red), color: FAMILY.red.ink }}>
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
