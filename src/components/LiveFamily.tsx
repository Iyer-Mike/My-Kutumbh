"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * A menu put up in the kitchen should show on every phone in the family.
 * Listens for changes to the family's rows and re-reads the page, with a
 * check on returning to the app in case the connection was asleep.
 */
export default function LiveFamily({ kutumbhId, tables }: { kutumbhId: string; tables: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!kutumbhId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Several rows often change together (adding four dishes at once),
    // so wait a moment and re-read once.
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase.channel(`family-${kutumbhId}`);
    for (const table of tables.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `kutumbh_id=eq.${kutumbhId}` },
        refreshSoon,
      );
    }
    channel.subscribe();

    // Phones suspend sockets in the background; catch up on return
    const onWake = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [kutumbhId, tables, router]);

  return null;
}
