"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthHeader from "@/components/AuthHeader";

const FAILED = "Reset link is invalid or has expired. Please request a new one.";

// createBrowserClient sets detectSessionInUrl, so the SDK exchanges the ?code=
// itself on creation. Calling exchangeCodeForSession manually races that and
// fails with "PKCE code verifier not found" - so just wait for the session.
export default function AuthCodeHandler() {
  const router = useRouter();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    const finish = (path: string) => {
      if (done) return;
      done = true;
      router.replace(path);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish("/reset-password");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish("/reset-password");
    });

    const stallTimer = setTimeout(() => setStalled(true), 5000);

    const giveUp = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) finish("/reset-password");
      else finish(`/forgot-password?error=${encodeURIComponent(FAILED)}`);
    }, 12000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(stallTimer);
      clearTimeout(giveUp);
    };
  }, [router]);

  return (
    <div className="w-full max-w-sm text-center">
      <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />
      <div className="rounded-2xl px-5 py-6" style={{ background: "#E7DCF7", border: "1px solid #C6DFBE" }}>
        <p className="text-2xl mb-2">🔐</p>
        <p className="font-semibold text-sm" style={{ color: "#241238" }}>
          {stalled ? "Still working…" : "Verifying your link"}
        </p>
        <p className="text-sm mt-1" style={{ color: "#625A75" }}>
          {stalled
            ? "Taking longer than usual. If nothing happens, request a fresh reset link."
            : "One moment while we check your reset link."}
        </p>
      </div>
    </div>
  );
}
