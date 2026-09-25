"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { writeLastUser } from "@/lib/last-user";

export default function ResetPasswordPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [sessionOk, setSessionOk]   = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionOk(!!session);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Who this is, asked while the reset session is still good for asking
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : { data: null };

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Changing the password ends the sessions that were open, this one among
    // them, so walking straight into the app left people holding a key that no
    // longer turned — and the app, unable to read them, offered to sign them
    // up afresh. They sign in once with the new password instead.
    if (user?.email) {
      writeLastUser({ email: user.email, name: profile?.full_name?.split(" ")[0] ?? null });
    }

    await supabase.auth.signOut();
    router.push("/login?changed=1");
  }

  if (sessionOk === false) {
    return (
      <div className="w-full max-w-sm">
        <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />
        <div className="rounded-2xl px-5 py-6 text-center"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <p className="text-2xl mb-2">🔗</p>
          <p className="font-semibold text-sm mb-1" style={{ color: "#B91C1C" }}>Reset link has expired</p>
          <p className="text-sm" style={{ color: "#625A75" }}>
            This link is invalid or has already been used. Please request a fresh one.
          </p>
        </div>
        <p className="text-center mt-5">
          <Link href="/forgot-password" className="text-sm font-semibold" style={{ color: "#6B46B8" }}>
            Request new reset link →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />

      <p className="text-sm mb-5" style={{ color: "#625A75" }}>
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: "1.5px solid #E0D4F2", background: "#F0EAFA", color: "#241C33" }}
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1" style={{ color: "#625A75" }}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: "1.5px solid #E0D4F2", background: "#F0EAFA", color: "#241C33" }}
            placeholder="••••••••"
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
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}
