"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { BRAND as B } from "@/lib/brand";

// Who last signed in on THIS phone. Email and first name only — never a
// password — so the box is already filled when they come back.
const LAST_USER = "mk-last-user-v1";
type LastUser = { email: string; name: string | null };

const listeners = new Set<() => void>();
let cached: string | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// Storage can throw or come back empty (private window, cleared data)
function getSnapshot(): string | null {
  try {
    const raw = localStorage.getItem(LAST_USER);
    if (raw !== cached) cached = raw;
  } catch {
    cached = null;
  }
  return cached;
}

function writeLastUser(value: LastUser | null) {
  const raw = value ? JSON.stringify(value) : null;
  try {
    if (raw) localStorage.setItem(LAST_USER, raw);
    else localStorage.removeItem(LAST_USER);
  } catch { /* private window — the page still works */ }
  cached = raw;
  listeners.forEach((l) => l());
}

function parseLastUser(raw: string | null): LastUser | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LastUser;
    return v && typeof v.email === "string" && v.email ? v : null;
  } catch {
    return null;
  }
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? "/dashboard";

  // Server render knows nothing about this phone, so it starts as a stranger
  const stored = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const known = useMemo(() => parseLastUser(stored), [stored]);

  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const email = typedEmail ?? known?.email ?? "";

  // A known face only has to type the password
  useEffect(() => {
    if (known && !typedEmail) passwordRef.current?.focus();
  }, [known, typedEmail]);

  function forgetMe() {
    writeLastUser(null);
    setTypedEmail("");
    setPassword("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes("not confirmed")) {
        setError("Please confirm your email first. Check your inbox for a confirmation link.");
      } else if (error.message.toLowerCase().includes("invalid")) {
        setError("Incorrect email or password. Please try again.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // Remember them on this phone for next time
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
      writeLastUser({ email, name: profile?.full_name?.split(" ")[0] ?? null });
    }
    router.push(redirectTo);
  }

  const signupHref = redirectTo !== "/dashboard"
    ? `/signup?redirect=${encodeURIComponent(redirectTo)}`
    : "/signup";

  const fieldStyle = { border: `1.5px solid ${B.cardEdge}`, background: B.field, color: B.ink } as const;

  return (
    <div className="w-full max-w-sm">
      {known ? (
        <div className="rounded-3xl px-6 pt-9 pb-7 mb-6" style={{ background: B.headerGradient }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[19px]"
              style={{ background: B.gold, color: "#2A1646", fontFamily: "var(--font-dm-serif)" }} aria-hidden>
              क
            </div>
            <div className="grid">
              <span className="text-[19px] leading-tight text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
                My Kutumbh
              </span>
              <span className="text-[11px] tracking-wide" style={{ color: B.onDarkFaint }}>मेरा कुटुम्ब</span>
            </div>
          </div>
          <h1 className="m-0 text-white text-[30px]" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.15 }}>
            {known.name ? `Namaste, ${known.name}` : "Namaste"}
            <span className="block italic" style={{ color: B.gold }}>welcome back.</span>
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: B.onDark }}>
            Your Kutumbh is waiting. Two taps and you&apos;re in.
          </p>
        </div>
      ) : (
        <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: B.muted }}>
            Email
          </label>
          <div className="flex items-center gap-2">
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setTypedEmail(e.target.value)}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm focus:outline-none"
              style={fieldStyle}
              placeholder="you@email.com"
            />
            {known && (
              <button type="button" onClick={forgetMe}
                className="shrink-0 text-xs font-semibold px-2 py-3"
                style={{ color: B.violetLink }}>
                Not you?
              </button>
            )}
          </div>
          {known && (
            <p className="mt-1 text-[11px]" style={{ color: B.muted2 }}>
              Remembered on this phone only. Your password is never stored.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: B.muted }}>
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium" style={{ color: B.violetLink }}>
              Forgot password?
            </Link>
          </div>
          <input
            ref={passwordRef}
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={fieldStyle}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FBE2DC", color: "#9A2C1B", border: "1px solid #F3C6BB" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: B.button }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: B.muted }}>
        New to My Kutumbh?{" "}
        <Link href={signupHref} className="font-semibold" style={{ color: B.violetLink }}>
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
