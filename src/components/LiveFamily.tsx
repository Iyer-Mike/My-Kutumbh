"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** How often an open page checks for itself, in case the socket went quiet. */
const CHECK_EVERY_MS = 20_000;

/**
 * A menu put up in the kitchen should show on every phone in the family.
 * Listens for changes to the family's rows and re-reads the page. Sockets
 * drop, phones sleep and networks block them, so the page also checks on
 * its own while it is on screen, and again on returning to the app.
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

    const beat = setInterval(onWake, CHECK_EVERY_MS);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(beat);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [kutumbhId, tables, router]);

  return null;
}
