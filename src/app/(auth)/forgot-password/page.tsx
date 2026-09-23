"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />

      {sent ? (
        <div className="space-y-4 text-center">
          <div
            className="rounded-2xl px-5 py-6"
            style={{ background: "#E7DCF7", border: "1px solid #C6DFBE" }}
          >
            <p className="text-2xl mb-2">📬</p>
            <p className="font-semibold text-sm" style={{ color: "#241238" }}>Check your inbox</p>
            <p className="text-sm mt-1" style={{ color: "#625A75" }}>
              We&apos;ve sent a password reset link to <strong>{email}</strong>.
              Check your spam folder if it doesn&apos;t arrive in a minute.
            </p>
          </div>
          <Link href="/login" className="block text-sm font-semibold" style={{ color: "#6B46B8" }}>
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm mb-5" style={{ color: "#625A75" }}>
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ border: "1.5px solid #E0D4F2", background: "#F0EAFA", color: "#241C33" }}
                placeholder="you@email.com"
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
              style={{ background: "#241238" }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link href="/login" className="font-semibold" style={{ color: "#6B46B8" }}>
              ← Back to sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
