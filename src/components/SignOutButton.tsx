"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
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
