"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * A signed-out person must not see a signed-in page again — not by the Back
 * button, not from a page the browser kept in memory, not in another tab.
 */
export default function SignedInGuard() {
  useEffect(() => {
    const supabase = createClient();
    const toLogin = () => window.location.replace("/login");

    // Signed out here or in another tab
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") toLogin();
    });

    // Back/forward can restore a page from the browser's memory without asking the server
    const onShow = async (e: PageTransitionEvent) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) toLogin();
      else if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  return null;
}
