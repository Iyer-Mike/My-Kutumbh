"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthHeader from "@/components/AuthHeader";

const FAILED = "Reset link is invalid or has expired. Please request a new one.";

// The PKCE code_verifier lives in browser storage, so the exchange has to run
// client-side. Doing it on the server fails with "code verifier not found".
export default function AuthCodeHandler() {
  const router = useRouter();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const code      = params.get("code");
    const tokenHash = params.get("token_hash");
    const type      = params.get("type") ?? "recovery";

    const supabase = createClient();

    (async () => {
      let errMsg: string | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        errMsg = error?.message ?? null;
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "recovery",
        });
        errMsg = error?.message ?? null;
      } else {
        errMsg = "no code in link";
      }

      if (errMsg) {
        router.replace(`/forgot-password?error=${encodeURIComponent(`${FAILED} [${errMsg}]`)}`);
      } else {
        router.replace("/reset-password");
      }
    })();

    const t = setTimeout(() => setStalled(true), 6000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="w-full max-w-sm text-center">
      <AuthHeader subtitle="Family food & wellness, rooted in Ayurveda" />
      <div className="rounded-2xl px-5 py-6" style={{ background: "#EAF2E8", border: "1px solid #C6DFBE" }}>
        <p className="text-2xl mb-2">🔐</p>
        <p className="font-semibold text-sm" style={{ color: "#1C2B1C" }}>
          {stalled ? "Still working…" : "Verifying your link"}
        </p>
        <p className="text-sm mt-1" style={{ color: "#5A6055" }}>
          {stalled
            ? "This is taking longer than expected. If nothing happens, request a fresh reset link."
            : "One moment while we check your reset link."}
        </p>
      </div>
    </div>
  );
}
