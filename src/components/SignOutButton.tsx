"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (compact) {
    return (
      <button
        onClick={handleSignOut}
        className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full py-3 rounded-xl text-sm font-medium"
      style={{ background: "#fff", border: "1.5px solid #E2E1D8", color: "#8A9085" }}
    >
      Sign out
    </button>
  );
}
