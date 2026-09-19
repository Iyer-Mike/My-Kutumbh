"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import KutumbhLogo from "@/components/KutumbhLogo";

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? null;

  const [email, setEmail] = useState("");
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      window.location.href = redirectTo ?? "/onboarding";
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
          style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 60%, #3D6638 100%)" }}
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
          <p className="text-sm font-semibold mt-1" style={{ color: "#8FBF88" }}>{email}</p>
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
            Click the link, then come back here to sign in.
          </p>
        </div>
        <Link
          href={loginHref}
          className="block w-full py-3.5 rounded-xl font-semibold text-sm text-white text-center"
          style={{ background: "#1C2B1C" }}
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
          <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: "#5A6055" }}>
            Your name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: "1.5px solid #E2E1D8", background: "#F3F2EB", color: "#1C201C" }}
            placeholder="Mohan Iyer"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "#5A6055" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: "1.5px solid #E2E1D8", background: "#F3F2EB", color: "#1C201C" }}
            placeholder="you@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: "#5A6055" }}>
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
            style={{ border: "1.5px solid #E2E1D8", background: "#F3F2EB", color: "#1C201C" }}
            placeholder="Min. 8 characters"
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: "#1C2B1C" }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: "#8A9085" }}>
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold" style={{ color: "#4A7C44" }}>
          Sign in
        </Link>
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
