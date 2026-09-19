"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinButton({ code }: { code: string }) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/invite/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to join"); return; }

      // Check if this user has completed onboarding yet
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.id)
          .single();
        router.push(profile?.onboarding_complete ? "/family" : "/onboarding");
      } else {
        router.push("/family");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "#1C2B1C" }}
      >
        {loading ? "Joining…" : "Join Family"}
      </button>
      {error && (
        <p className="text-xs text-center" style={{ color: "#C0392B" }}>{error}</p>
      )}
    </div>
  );
}
